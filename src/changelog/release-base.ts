import * as Git from './git.js';
import { npmVersionInfo } from './npm.js';

export interface ReleasedPackage {
  name: string;
  /** the version in package.json, which is the last released version */
  version: string;
  pkgJSONPath: string;
}

export type ReleaseBase =
  | {
      ref: string;
      source: 'tag' | 'npm-git-head' | 'version-commit';
    }
  | { ref: undefined; source: 'never-released' };

/**
 * Finds the commit of the last release of one package.
 * Changes after that commit go in the next release.
 *
 * In order of trust:
 *
 * 1. the git tag that `release-plan publish` made for this version
 * 2. the `gitHead` that npm recorded for this version
 * 3. the commit that set the version in package.json
 *
 * When npm says that the version was never published,
 * all of the history of the package is unreleased.
 */
export async function findReleaseBase(
  pkg: ReleasedPackage,
  options: { suffixedTags: boolean },
): Promise<ReleaseBase> {
  for (const tag of tagCandidates(pkg, options.suffixedTags)) {
    const ref = reachable(tag);
    if (ref) {
      return { ref, source: 'tag' };
    }
  }

  const npm = await npmVersionInfo(pkg.name, pkg.version);
  if (npm?.published === false) {
    return { ref: undefined, source: 'never-released' };
  }
  if (npm?.gitHead) {
    const ref = reachable(npm.gitHead);
    if (ref) {
      return { ref, source: 'npm-git-head' };
    }
  }

  const ref = Git.lastVersionChange(pkg.pkgJSONPath);
  if (ref) {
    return { ref, source: 'version-commit' };
  }
  return { ref: undefined, source: 'never-released' };
}

/**
 * Must match the tag names in publish.ts.
 *
 * A repo that went from many packages to one can still have
 * suffixed tags for the remaining package.
 */
function tagCandidates(pkg: ReleasedPackage, suffixedTags: boolean) {
  const suffixed = `v${pkg.version}-${pkg.name}`;
  return suffixedTags ? [suffixed] : [`v${pkg.version}`, suffixed];
}

function reachable(ref: string): string | undefined {
  const sha = Git.commitFor(ref);
  if (sha && Git.isAncestor(sha)) {
    return sha;
  }
}
