export type Impact = 'major' | 'minor' | 'patch';
export type UnlabeledSection = { unlabeled: true; summaryText: string };

// entries are the change descriptions with their leading bullet stripped.
// packages is empty for the "Other" group and for repos whose changelog has no
// package attribution at all.
export type ChangeGroup = { packages: string[]; entries: string[] };

export type LabeledSection = {
  packages: string[];
  groups: ChangeGroup[];
  impact: Impact;
  heading: string;
};
export type Section = LabeledSection | UnlabeledSection;
export interface ParsedChangelog {
  sections: Section[];
}

const knownSections: Record<string, { impact: Impact } | { unlabeled: true }> =
  {
    ':boom: Breaking Change': {
      impact: 'major',
    },
    ':rocket: Enhancement': {
      impact: 'minor',
    },
    ':bug: Bug Fix': {
      impact: 'patch',
    },
    ':memo: Documentation': {
      impact: 'patch',
    },
    ':house: Internal': {
      impact: 'patch',
    },
    ':question: Unlabeled': {
      unlabeled: true,
    },
    ':present: Additional updates': {
      unlabeled: true,
    },
  };

const ignoredSections = [/Committers: \d+/];

function sectionHeading(line: string): string | undefined {
  if (line.startsWith('#### ')) {
    return line.slice(5);
  }
}

function stillWithinSection(lines: string[]): boolean {
  return lines.length > 0 && !sectionHeading(lines[0]);
}

function consumeSection(lines: string[]) {
  const matchedLines = [];
  while (stillWithinSection(lines)) {
    matchedLines.push(lines.shift());
  }
  return matchedLines;
}

function parseSection(lines: string[]): Section | undefined {
  const line = lines.shift();
  const heading = line ? sectionHeading(line) : undefined;
  if (!heading) {
    return;
  }

  const sectionConfig = knownSections[heading];
  if (!sectionConfig) {
    if (ignoredSections.some((pattern) => pattern.test(heading))) {
      consumeSection(lines);
      return;
    }
    throw new Error(`unexpected section: ${heading}`);
  }

  if ('unlabeled' in sectionConfig) {
    return { unlabeled: true, summaryText: consumeSection(lines).join('\n') };
  }

  const packages = new Set<string>();
  const groups: ChangeGroup[] = [];
  let unattributed: ChangeGroup | undefined;

  while (stillWithinSection(lines)) {
    const line = lines.shift()!;
    if (!line.trim()) {
      continue;
    }

    const packageList = parsePackageList(line);
    if (packageList) {
      for (const pkg of packageList) {
        packages.add(pkg);
      }
      groups.push({ packages: packageList, entries: consumeEntries(lines) });
      continue;
    }

    if (!unattributed) {
      unattributed = { packages: [], entries: [] };
      groups.push(unattributed);
    }
    if (line === '* Other') {
      unattributed.entries.push(...consumeEntries(lines));
    } else {
      unattributed.entries.push(stripBullet(line));
    }
  }

  return {
    packages: [...packages],
    groups,
    impact: sectionConfig.impact,
    heading,
  };
}

function stripBullet(line: string): string {
  return line.replace(/^\s*\*\s+/, '');
}

// the change descriptions belonging to a package list are indented beneath it
function consumeEntries(lines: string[]): string[] {
  const entries: string[] = [];
  while (stillWithinSection(lines) && /^\s+\*\s/.test(lines[0])) {
    entries.push(stripBullet(lines.shift()!));
  }
  return entries;
}

function parsePackageList(line: string): string[] | undefined {
  if (line === '* Other') {
    return;
  }
  if (line.startsWith('* `')) {
    const parts = line.slice(2).split(/,\s*/);
    if (!parts.every((p) => p.startsWith('`') && p.endsWith('`'))) {
      throw new Error(`don't understand this line: ${line}.`);
    }
    return parts.map((p) => p.slice(1, -1));
  }
}

export function parseChangeLog(src: string): ParsedChangelog {
  const lines = src.split('\n');
  const sections = [];
  while (lines.length > 0) {
    const section = parseSection(lines);
    if (section) {
      sections.push(section);
    }
  }
  return { sections };
}

export function parseChangeLogOrExit(src: string): ParsedChangelog {
  try {
    return parseChangeLog(src);
  } catch (err) {
    console.error(err);
    console.error(`the full changelog that failed to parse was:\n${src}`);
    process.exit(-1);
  }
}
