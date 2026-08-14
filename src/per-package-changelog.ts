import { dirname, join } from 'node:path';
import type { ParsedChangelog } from './change-parser.js';
import type { Solution } from './plan.js';
import { prependToChangelog } from './changelog-file.js';

const dependencyUpdatesHeading = ':arrow_up: Dependency Updates';

type RenderedSection = { heading: string; entries: string[] };

export function updatePackageChangelogs(
  newChangelogContent: string,
  changes: ParsedChangelog,
  solution: Solution,
  singlePackage?: string,
): void {
  const date = releaseDate(newChangelogContent);

  for (const [pkgName, entry] of solution) {
    if (!entry.impact) {
      continue;
    }

    const sections = sectionsFor(changes, pkgName, singlePackage);

    const dependencyUpdates = entry.constraints
      .filter((constraint) => constraint.kind === 'dependency')
      .map((constraint) => constraint.reason);

    if (dependencyUpdates.length > 0) {
      sections.push({
        heading: dependencyUpdatesHeading,
        entries: dependencyUpdates,
      });
    }

    prependToChangelog(
      join(dirname(entry.pkgJSONPath), 'CHANGELOG.md'),
      render(entry.newVersion, date, sections),
      true,
    );
  }
}

function render(
  newVersion: string,
  date: string,
  sections: RenderedSection[],
): string {
  const lines = [`## v${newVersion} (${date})`];

  for (const section of sections) {
    lines.push('', `#### ${section.heading}`);
    lines.push(...section.entries.map((entry) => `* ${entry}`));
  }

  return lines.join('\n') + '\n';
}

function sectionsFor(
  changes: ParsedChangelog,
  pkgName: string,
  singlePackage: string | undefined,
): RenderedSection[] {
  const sections: RenderedSection[] = [];

  for (const section of changes.sections) {
    if ('unlabeled' in section) {
      continue;
    }

    const entries = section.groups
      .filter((group) =>
        // outside a monorepo nothing is attributed, so every change is this
        // package's change. Within one, unattributed changes bump nothing and
        // so belong in no package's changelog.
        singlePackage ? true : group.packages.includes(pkgName),
      )
      .flatMap((group) => group.entries);

    if (entries.length > 0) {
      sections.push({ heading: section.heading, entries });
    }
  }

  return sections;
}

function releaseDate(newChangelogContent: string): string {
  const heading = newChangelogContent.trim().split('\n')[0];
  const parenthesized = /\(([^)]*)\)\s*$/.exec(heading);
  return parenthesized
    ? parenthesized[1]
    : new Date().toISOString().slice(0, 10);
}
