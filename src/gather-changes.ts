import { dirname, resolve } from 'node:path';
import pMap from 'p-map';

import { sectionKind } from './change-parser.js';
import type { ParsedChangelog, Section } from './change-parser.js';
import Changelog from './changelog/changelog.js';
import type { PackageRange } from './changelog/changelog.js';
import { load as loadChangelogConfig } from './changelog/configuration.js';
import type { CommitInfo } from './changelog/interfaces.js';
import { findReleaseBase } from './changelog/release-base.js';
import { publishedInterPackageDeps } from './interdep.js';

export interface GatheredChanges {
  /** the changelog entry for the release */
  markdown: string;
  changes: ParsedChangelog;
}

/**
 * Reads git history to find what changed in each published package
 * since the last release of that package.
 */
export async function gatherChanges(): Promise<GatheredChanges> {
  const pkgs = publishedInterPackageDeps();

  const ranges: PackageRange[] = await pMap(
    pkgs,
    async ([name, entry]) => {
      const base = await findReleaseBase(
        { name, version: entry.version, pkgJSONPath: entry.pkgJSONPath },
        { suffixedTags: pkgs.size > 1 },
      );
      return {
        name,
        path: resolve(dirname(entry.pkgJSONPath)),
        from: base.ref,
      };
    },
    { concurrency: 5 },
  );

  const config = loadChangelogConfig({
    packages: ranges.map(({ name, path }) => ({ name, path })),
    nextVersion: 'Release',
  });
  const changelog = new Changelog(config);
  const commits = await changelog.listChanges(ranges);

  return {
    markdown: await changelog.renderMarkdown(commits),
    changes: toParsedChangelog(
      commits,
      Object.values(config.labels),
      changelog,
    ),
  };
}

function toParsedChangelog(
  commits: CommitInfo[],
  headings: string[],
  changelog: Changelog,
): ParsedChangelog {
  const sections: Section[] = [];

  for (const heading of headings) {
    const inSection = commits.filter((c) => c.categories?.includes(heading));
    if (inSection.length === 0) {
      continue;
    }

    const kind = sectionKind(heading);
    if (!kind) {
      throw new Error(`unexpected section: ${heading}`);
    }

    if ('unlabeled' in kind) {
      sections.push({
        unlabeled: true,
        summaryText: changelog.renderContributionList(inSection),
      });
    } else {
      const packages = new Set<string>();
      for (const commit of inSection) {
        for (const pkg of commit.packages ?? []) {
          packages.add(pkg);
        }
      }
      sections.push({
        packages: Array.from(packages),
        impact: kind.impact,
        heading,
      });
    }
  }

  return { sections };
}
