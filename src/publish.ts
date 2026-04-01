import { execa } from 'execa';
import type { Solution } from './plan.js';
import { loadSolution } from './plan.js';
import { Octokit } from '@octokit/rest';
import latestVersion from 'latest-version';
import { dirname } from 'path';
import PackageJson from '@npmcli/package-json';
import parseGithubUrl from 'parse-github-repo-url';
import fsExtra from 'fs-extra';

const { existsSync, readJSONSync } = fsExtra;

type PublishOptions = {
  skipRepoSafetyCheck?: boolean;
  dryRun?: boolean;
  otp?: string;
  publishBranch?: string;
  tag?: string;
  access?: string;
  provenance?: boolean;
  githubPrerelease?: boolean;
};

async function hasCleanRepo(): Promise<boolean> {
  const result = await execa('git', ['status', '--porcelain=v1']);
  return result.stdout.length === 0;
}

function shouldUseSuffixedTags(solution: Solution): boolean {
  return solution.size > 1;
}

function tagFor(
  pkgName: string,
  entry: { newVersion: string },
  useSuffix: boolean,
): string {
  if (!useSuffix) {
    return `v${entry.newVersion}`;
  }
  return `v${entry.newVersion}-${pkgName}`;
}

function info(message: string) {
  process.stdout.write(`\n ℹ️ ${message}`);
}

function success(message: string) {
  process.stdout.write(`\n 🎉 ${message} 🎉\n`);
}

export class IssueReporter {
  hadIssues = false;
  reportFailure(message: string): void {
    this.hadIssues = true;
    process.stderr.write(message);
  }
}
async function doesTagExist(
  octokit: Octokit,
  tag: string,
  reporter: IssueReporter,
) {
  try {
    const { owner, repo } = await getRepo();
    const response = await octokit.git.getRef({
      owner,
      repo,
      ref: `tags/${tag}`,
    });

    return response.status === 200;
  } catch (err) {
    if (err.status === 404) {
      return false;
    }
    console.error(err.message);
    reporter.reportFailure(`Problem while checking for existing GitHub tag`);
  }
}

async function getSha(cwd: string): Promise<string> {
  const result = await execa('git', ['rev-parse', 'HEAD'], { cwd });

  return result.stdout.trim();
}

async function makeTags(
  solution: Solution,
  reporter: IssueReporter,
  octokit: Octokit,
  options: PublishOptions,
  useSuffix: boolean,
): Promise<void> {
  for (const [pkgName, entry] of solution) {
    if (!entry.impact) {
      continue;
    }
    try {
      const tag = tagFor(pkgName, entry, useSuffix);
      const cwd = dirname(entry.pkgJSONPath);
      const sha = await getSha(cwd);

      const preExisting = await doesTagExist(octokit, tag, reporter);

      if (preExisting) {
        info(`The tag, ${tag}, has already been pushed up for ${pkgName}`);
        return;
      }

      if (options.dryRun) {
        info(`--dryRun active. Skipping \`git tag ${tag}\``);
        continue;
      }

      const { owner, repo } = await getRepo();
      octokit.git.createRef({
        owner,
        repo,
        sha,
        ref: `refs/tags/${tag}`,
        type: 'commit',
      });
    } catch (err) {
      console.error(err);
      reporter.reportFailure(`Failed to create tag for ${pkgName}`);
    }
  }
}

function chooseRepresentativeTag(
  solution: Solution,
  useSuffix: boolean,
): string {
  for (const [pkgName, entry] of solution) {
    if (entry.impact) {
      return tagFor(pkgName, entry, useSuffix);
    }
  }
  process.stderr.write('Found no releasable packages in the plan');
  process.exit(-1);
}

async function getRepo(): Promise<{ owner: string; repo: string }> {
  const pkgJson = await PackageJson.load('./');
  const normalisedJson = await pkgJson.normalize({
    steps: ['fixRepositoryField'],
  });

  if (!normalisedJson.content.repository) {
    throw new Error('This package does not have a repository defined');
  }

  const parsed = parseGithubUrl(
    (normalisedJson.content.repository as { url: string }).url,
  );

  if (!parsed) {
    throw new Error('This package does not have a valid repository');
  }

  const [user, repo] = parsed;
  return { owner: user, repo };
}

async function doesReleaseExist(
  octokit: Octokit,
  tagName: string,
  reporter: IssueReporter,
) {
  try {
    const { owner, repo } = await getRepo();
    const response = await octokit.repos.getReleaseByTag({
      owner,
      repo,
      tag: tagName,
    });

    return response.status === 200;
  } catch (err) {
    if (err.status === 404) {
      return false;
    }
    console.error(err.message);
    reporter.reportFailure(
      `Problem while checking for existing GitHub release`,
    );
  }
}

export async function createGithubRelease(
  octokit: Octokit,
  description: string,
  tagName: string,
  reporter: IssueReporter,
  options: PublishOptions,
): Promise<void> {
  try {
    const preExisting = await doesReleaseExist(octokit, tagName, reporter);

    if (preExisting) {
      info(`A release with the name '${tagName}' already exists`);
      return;
    }

    if (options.dryRun) {
      info(
        `--dryRun active. Skipping creating a Release on GitHub for ${tagName}`,
      );
      return;
    }

    const { owner, repo } = await getRepo();

    await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      target_commitish: process.env.GITHUB_SHA,
      name: tagName,
      body: description,
      prerelease: options.githubPrerelease ?? false,
    });
  } catch (err) {
    console.error(err);
    reporter.reportFailure(`Problem while creating GitHub release`);
  }
}

async function doesVersionExist(
  pkgName: string,
  version: string,
  reporter: IssueReporter,
) {
  try {
    const latest = await latestVersion(pkgName, { version });
    return Boolean(latest);
  } catch (err) {
    if (
      err.name === 'VersionNotFoundError' ||
      err.name === 'PackageNotFoundError'
    ) {
      return false;
    }

    console.error(err.message);
    reporter.reportFailure(`Problem while checking for existing npm release`);
  }
}

/**
 * Call npm publish or pnpm publish on each of the packages in a plan
 *
 * @returns Promise<T> return value only used for testing
 */
export async function npmPublish(
  solution: Solution,
  reporter: IssueReporter,
  options: PublishOptions,
  packageManager: string,
): Promise<void> {
  const args = ['publish'];

  if (options.otp) {
    args.push(`--otp=${options.otp}`);
  }

  if (options.publishBranch) {
    args.push(`--publish-branch=${options.publishBranch}`);
  }

  if (options.tag) {
    throw new Error(
      `The '--tag' option has been removed. If you want to publish a package with a tag other than latest please set the 'release-plan.publishTag' setting in your package.json.`,
    );
  }

  if (options.access) {
    args.push(`--access=${options.access}`);
  }

  if (options.dryRun) {
    args.push('--dry-run');
  }

  if (options.provenance) {
    args.push('--provenance');
  }

  const released = new Map();

  for (const [pkgName, entry] of solution) {
    if (!entry.impact) {
      continue;
    }

    const pkg = readJSONSync(entry.pkgJSONPath);
    if (pkg['release-plan']?.skipNpmPublish) {
      info(
        `skipping publish for ${pkgName}, as config option skipNpmPublish is set in its package.json`,
      );
      continue;
    }

    const preExisting = await doesVersionExist(
      pkgName,
      entry.newVersion,
      reporter,
    );

    if (preExisting) {
      info(
        `${pkgName} has already been published @ version ${entry.newVersion}. Skipping publish;`,
      );
      continue;
    }

    if (options.dryRun) {
      info(
        `--dryRun active. Adding \`--dry-run\` flag to \`${packageManager} publish${
          options.otp ? ' --otp=*redacted*' : ''
        }\` for ${pkgName}, which would publish version ${entry.newVersion}\n`,
      );
      released.set(pkgName, entry.newVersion);
    }

    try {
      await execa(packageManager, [...args, `--tag=${entry.tagName}`], {
        cwd: dirname(entry.pkgJSONPath),
        stderr: 'inherit',
        stdout: 'inherit',
      });
      released.set(pkgName, entry.newVersion);
    } catch (err) {
      reporter.reportFailure(
        `Failed to ${packageManager} publish ${pkgName} - Error: ${err.message}`,
      );
    }
  }
}

function packageManager(): string {
  if (existsSync('./pnpm-lock.yaml')) {
    return 'pnpm';
  }

  return 'npm';
}

export async function publish(opts: PublishOptions) {
  if (!opts.skipRepoSafetyCheck) {
    if (!(await hasCleanRepo())) {
      process.stderr.write(`You have uncommitted changes.
To publish a release you should start from a clean repo. Run "npx release-plan prepare", then commit the changes, then come back and run "npx release-plan publish.
`);
      process.exit(-1);
    }
  }

  const { solution, description } = loadSolution();

  if (!process.env.GITHUB_AUTH) {
    process.stderr.write(`\nYou need to set GITHUB_AUTH.`);
    process.exit(-1);
  }

  let baseUrl = undefined;
  if (process.env.GITHUB_DOMAIN) {
    baseUrl = `https://api.${process.env.GITHUB_DOMAIN}`;
  }
  if (process.env.GITHUB_API_URL) {
    baseUrl = process.env.GITHUB_API_URL;
  }
  const octokit = new Octokit({
    auth: process.env.GITHUB_AUTH,
    baseUrl,
  });

  const useSuffix = shouldUseSuffixedTags(solution);
  const representativeTag = chooseRepresentativeTag(solution, useSuffix);

  // from this point forward we don't stop if something goes wrong, we just keep
  // track of whether anything went wrong so we can use the right exit code at
  // the end.
  const reporter = new IssueReporter();

  await makeTags(solution, reporter, octokit, opts, useSuffix);
  await npmPublish(solution, reporter, opts, packageManager());
  await createGithubRelease(
    octokit,
    description,
    representativeTag,
    reporter,
    opts,
  );

  if (reporter.hadIssues) {
    process.stderr.write(`\nSome parts of the release were unsuccessful.\n`);
    process.exit(-1);
  } else {
    if (opts.dryRun) {
      success(`--dryRun active. Would have successfully published release!`);
      return;
    }

    success(`Successfully published release`);
  }
}
