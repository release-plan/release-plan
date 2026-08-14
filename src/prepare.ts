import { parseChangeLogOrExit } from './change-parser.js';
import type { Solution } from './plan.js';
import { planVersionBumps, saveSolution } from './plan.js';
import { prependToChangelog } from './changelog-file.js';
import { changelogPerPackage } from './config.js';
import { updatePackageChangelogs } from './per-package-changelog.js';
// eslint-disable-next-line n/no-missing-import
import { readJSONSync, writeJSONSync } from './util.js';

// also used as the body of the GitHub release, so it is built even when no
// aggregate changelog gets written
export function releaseEntry(
  newChangelogContent: string,
  solution: Solution,
): string {
  const [firstNewLine, ...restNewLines] = newChangelogContent
    .trim()
    .split('\n');

  return (
    firstNewLine +
    '\n\n' +
    versionSummary(solution) +
    '\n' +
    restNewLines.join('\n') +
    '\n'
  );
}

export function updateChangelog(
  newChangelogContent: string,
  solution: Solution,
): string {
  const entry = releaseEntry(newChangelogContent, solution);
  prependToChangelog('./CHANGELOG.md', entry);
  return entry;
}

function versionSummary(solution: Solution): string {
  const result: string[] = [];
  for (const [pkgName, entry] of solution) {
    if (entry.impact) {
      result.push(`* ${pkgName} ${entry.newVersion} (${entry.impact})`);
    }
  }
  return result.join('\n');
}

function updateVersions(solution: Solution) {
  for (const entry of solution.values()) {
    if (entry.impact) {
      const pkg = readJSONSync(entry.pkgJSONPath);
      pkg.version = entry.newVersion;
      writeJSONSync(entry.pkgJSONPath, pkg, { spaces: 2 });
    }
  }
}

export async function prepare(
  newChangelogContent: string,
  singlePackage?: string,
) {
  const changes = parseChangeLogOrExit(newChangelogContent);
  const solution = planVersionBumps(changes, singlePackage);
  updateVersions(solution);

  let description: string;
  if (changelogPerPackage()) {
    description = releaseEntry(newChangelogContent, solution);
    updatePackageChangelogs(
      newChangelogContent,
      changes,
      solution,
      singlePackage,
    );
  } else {
    description = updateChangelog(newChangelogContent, solution);
  }

  saveSolution(solution, description);
  return solution;
}
