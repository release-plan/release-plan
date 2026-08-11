import type { Impact, ParsedChangelog } from './change-parser.js';
import { publishedInterPackageDeps } from './interdep.js';
import { assertNever } from 'assert-never';
import semver from 'semver';
import { highlightMarkdown } from './highlight.js';
import chalk from 'chalk';
import { resolve } from 'path';
import fsExtra from 'fs-extra';

const { inc, satisfies } = semver;

const { existsSync, readJSONSync, writeJSONSync } = fsExtra;

export type Solution = Map<
  string,
  | { impact: undefined; oldVersion: string }
  | {
      impact: Impact;
      oldVersion: string;
      newVersion: string;
      tagName: string;
      constraints: { impact: Impact; reason: string }[];
      pkgJSONPath: string;
    }
>;

class Plan {
  #constraints: Map<string, { impact: Impact; reason: string }[]>;
  #pkgs: ReturnType<typeof publishedInterPackageDeps>;

  constructor() {
    this.#pkgs = publishedInterPackageDeps();

    // initialize constraints for every published package
    const constraints = new Map<string, { impact: Impact; reason: string }[]>();
    for (const pkg of this.#pkgs.keys()) {
      constraints.set(pkg, []);
    }
    this.#constraints = constraints;
  }

  addConstraint(packageName: string, impact: Impact, reason: string): void {
    const pkgConstraints = this.#constraints.get(packageName);
    if (!pkgConstraints) {
      console.warn(chalk.yellow(`Warning: unknown package "${packageName}"`));
      return;
    }
    if (
      !pkgConstraints.some(
        (existing) => existing.impact === impact && existing.reason === reason,
      )
    ) {
      pkgConstraints.push({ impact, reason });
      this.#propagate(packageName, impact);
    }
  }

  solve(): Solution {
    const solution: Solution = new Map();
    for (const [pkgName, entry] of this.#pkgs) {
      const constraints = this.#constraints.get(pkgName)!;
      const impact = this.#sumImpact(constraints);
      if (!impact) {
        solution.set(pkgName, { impact: undefined, oldVersion: entry.version });
      } else {
        const newVersion = inc(
          entry.version,
          this.#configureImpact(pkgName, impact),
          this.#semverTag(pkgName),
        )!;
        solution.set(pkgName, {
          impact,
          oldVersion: entry.version,
          newVersion,
          tagName: this.#publishTag(pkgName),
          constraints,
          pkgJSONPath: entry.pkgJSONPath,
        });
      }
    }
    return solution;
  }

  #configureImpact(pkgName: string, impact: Impact): Impact {
    const packageJson = this.#pkgs.get(pkgName)?.pkg;
    if (packageJson && packageJson['release-plan']?.semverIncrementAs) {
      const semverOverrides = packageJson['release-plan'].semverIncrementAs;
      if (semverOverrides[impact]) {
        return semverOverrides[impact];
      }
    }
    return impact;
  }

  #semverTag(pkgName: string): string {
    const packageJson = this.#pkgs.get(pkgName)?.pkg;
    return packageJson?.['release-plan']?.semverIncrementTag;
  }

  #publishTag(pkgName: string): string {
    const packageJson = this.#pkgs.get(pkgName)?.pkg;
    return packageJson?.['release-plan']?.publishTag ?? 'latest';
  }

  #expandWorkspaceRange(
    range: `workspace:${string}`,
    availableVersion: string,
  ): string {
    // this implements PNPM's rules for how workspace: protocol dependencies get
    // expanded into proper semver ranges.
    switch (range) {
      case 'workspace:*':
        return availableVersion;
      case 'workspace:~':
        return `~${availableVersion}`;
      case 'workspace:^':
        return `^${availableVersion}`;
      default:
        return range.slice(10);
    }
  }

  #propagate(packageName: string, impact: Impact) {
    const entry = this.#pkgs.get(packageName)!;
    const minNewVersion = inc(entry.version, impact)!;
    for (const [consumerName, workspaceRange] of entry.isDependencyOf) {
      this.#propagateDep(
        packageName,
        minNewVersion,
        'dependencies',
        consumerName,
        workspaceRange,
      );
    }
    for (const [consumerName, workspaceRange] of entry.isPeerDependencyOf) {
      this.#propagateDep(
        packageName,
        minNewVersion,
        'peerDependencies',
        consumerName,
        workspaceRange,
      );
    }
  }

  #propagateDep(
    packageName: string,
    minNewVersion: string,
    section: 'dependencies' | 'peerDependencies',
    consumerName: string,
    workspaceRange: `workspace:${string}`,
  ) {
    const entry = this.#pkgs.get(packageName)!;

    const oldRange = this.#expandWorkspaceRange(workspaceRange, entry.version);
    if (!satisfies(minNewVersion, oldRange)) {
      switch (section) {
        case 'dependencies':
          this.addConstraint(
            consumerName,
            'patch',
            `Has dependency ${'`'}${workspaceRange}${'`'} on ${packageName}`,
          );
          break;
        case 'peerDependencies':
          this.addConstraint(
            consumerName,
            'major',
            `Has peer dependency ${'`'}${workspaceRange}${'`'} on ${packageName}`,
          );
          break;
        default:
          throw assertNever(section);
      }
    }
  }

  #sumImpact(impacts: { impact: Impact }[]): Impact | undefined {
    if (impacts.some((i) => i.impact === 'major')) {
      return 'major';
    }
    if (impacts.some((i) => i.impact === 'minor')) {
      return 'minor';
    }
    if (impacts.some((i) => i.impact === 'patch')) {
      return 'patch';
    }
  }
}

function impactLabel(impact: Impact | undefined, text?: string) {
  switch (impact) {
    case undefined:
      return chalk.gray(text);
    case 'patch':
      return chalk.blueBright(text);
    case 'minor':
      return chalk.greenBright(text);
    case 'major':
      return chalk.redBright(text);
  }
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

export function explain(solution: Solution) {
  const output: string[] = [];

  for (const priority of ['major', 'minor', 'patch'] as const) {
    if ([...solution].some((entry) => entry[1].impact === priority)) {
      output.push(impactLabel(priority, capitalize(priority)));
      output.push('');

      for (const [pkgName, entry] of solution) {
        if (entry.impact === priority) {
          output.push(
            `  ${impactLabel(entry.impact, pkgName)} from ${
              entry.oldVersion
            } to ${entry.newVersion}`,
          );
          for (const constraint of entry.constraints) {
            if (constraint.impact === entry.impact) {
              output.push(`   - ${constraint.reason}`);
            }
          }
        }
      }
      output.push('');
    }
  }

  if ([...solution].some((entry) => entry[1].impact === undefined)) {
    output.push(impactLabel(undefined, 'Unreleased'));
    output.push('');
    for (const [pkgName, entry] of solution) {
      if (entry.impact === undefined) {
        output.push(`## ${pkgName}`);
        output.push(`  ${impactLabel(entry.impact, pkgName)} unchanged`);
      }
    }
    output.push('');
  }

  return output.join('\n');
}

export function planVersionBumps(changed: ParsedChangelog): Solution {
  const plan = new Plan();
  for (const section of changed.sections) {
    if ('unlabeled' in section) {
      process.stderr.write(
        highlightMarkdown(
          `# Unlabeled Changes\n\n${section.summaryText}\n\n*Cannot plan release until the above changes are labeled*.\n`,
        ),
      );
      process.exit(-1);
    }

    for (const pkg of section.packages) {
      plan.addConstraint(
        pkg,
        section.impact,
        `Appears in changelog section ${section.heading}`,
      );
    }
  }

  return plan.solve();
}

function solutionFile(): string {
  return resolve('./.release-plan.json');
}

export function saveSolution(solution: Solution, description: string): void {
  writeJSONSync(
    solutionFile(),
    { solution: Object.fromEntries(solution), description },
    { spaces: 2 },
  );
}

export function loadSolution(): { solution: Solution; description: string } {
  try {
    if (!existsSync(solutionFile())) {
      const err = new Error(`No such file ${solutionFile()}`);
      (err as any).code = 'ENOENT';
      throw err;
    }
    const json = readJSONSync(solutionFile());
    return {
      solution: new Map(Object.entries(json.solution)),
      description: json.description,
    };
  } catch (err) {
    process.stderr.write(
      `Unable to load release plan file. You must run "release-plan prepare" first to create the file.\n`,
    );
    if (err.code !== 'ENOENT') {
      console.error(err);
    }
    process.exit(-1);
  }
}
