import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  npmPublish,
  publish,
  createGithubRelease,
  IssueReporter,
} from './publish.js';
import { Solution } from './plan.js';
import { getPackages } from './interdep.js';
import { execa } from 'execa';

vi.mock('execa', (importOriginal) => {
  return {
    execa: vi.fn().mockImplementation(async (command, ...rest) => {
      if (command === 'git') {
        return (await importOriginal<typeof import('execa')>()).execa(
          command,
          ...rest,
        );
      }
    }),
  };
});

// we aren't currently using this so we can just ignore for now
const reporter = new IssueReporter();

const octokit = vi.fn();
vi.mock('@octokit/rest', () => {
  return {
    Octokit: function (...args: any) {
      octokit(...args);
      return {
        repos: {
          getReleaseByTag() {
            const err = new Error() as any;
            err.status = 404;
            throw err;
          },
        },
        git: {
          getRef() {
            const err = new Error() as any;
            err.status = 404;
            throw err;
          },
        },
      };
    },
  };
});

vi.stubEnv('GITHUB_SHA', 'test-sha');

describe('publish', function () {
  it('publish support custom base api url', function () {
    process.env.GITHUB_API_URL = 'https://api.custombase.com';
    process.env.GITHUB_AUTH = 'auth';
    publish({
      skipRepoSafetyCheck: true,
      dryRun: true,
    });
    expect(octokit.mock.calls.length).toBe(1);
    expect(octokit.mock.lastCall).toMatchInlineSnapshot(`
      [
        {
          "auth": "auth",
          "baseUrl": "https://api.custombase.com",
        },
      ]
    `);
  });

  it('publish support custom base domain', function () {
    vi.clearAllMocks();
    delete process.env.GITHUB_API_URL;
    process.env.GITHUB_DOMAIN = 'custombase.com';
    process.env.GITHUB_AUTH = 'auth';
    publish({
      skipRepoSafetyCheck: true,
      dryRun: true,
    });
    expect(octokit.mock.calls.length).toBe(1);
    expect(octokit.mock.lastCall).toMatchInlineSnapshot(`
      [
        {
          "auth": "auth",
          "baseUrl": "https://api.custombase.com",
        },
      ]
    `);
  });

  describe('npmPublish', function () {
    let solution: Solution;

    beforeEach(() => {
      solution = new Map();
      solution.set('thingy', {
        oldVersion: '3',
        newVersion: '4',
        impact: 'minor',
        constraints: [],
        tagName: 'latest',
        pkgJSONPath: './package.json',
      });
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('adds the correct args with no options', async function () {
      await npmPublish(solution, reporter, {}, 'fake-npm');

      expect(execa).toBeCalledWith('fake-npm', ['publish', '--tag=latest'], {
        cwd: '.',
        stderr: 'inherit',
        stdout: 'inherit',
      });
    });

    it('adds access if passed by options', async function () {
      await npmPublish(
        solution,
        reporter,
        { access: 'restricted' },
        'fake-npm',
      );

      expect(execa).toBeCalledWith(
        'fake-npm',
        ['publish', '--access=restricted', '--tag=latest'],
        {
          cwd: '.',
          stderr: 'inherit',
          stdout: 'inherit',
        },
      );
    });

    it('adds otp if passed by options', async function () {
      await npmPublish(
        solution,
        reporter,
        {
          otp: '12345',
        },
        'fake-npm',
      );

      expect(execa).toBeCalledWith(
        'fake-npm',
        ['publish', '--otp=12345', '--tag=latest'],
        {
          cwd: '.',
          stderr: 'inherit',
          stdout: 'inherit',
        },
      );
    });

    it('adds publish-branch if passed by options', async function () {
      await npmPublish(
        solution,
        reporter,
        {
          publishBranch: 'best-branch',
        },
        'fake-pnpm',
      );

      expect(execa).toBeCalledWith(
        'fake-pnpm',
        ['publish', '--publish-branch=best-branch', '--tag=latest'],
        {
          cwd: '.',
          stderr: 'inherit',
          stdout: 'inherit',
        },
      );
    });

    it('throws an error if --tag is passed on the command line', async function () {
      expect(
        npmPublish(
          solution,
          reporter,
          {
            tag: 'face',
          },
          'fake-npm',
        ),
      ).rejects.toThrow(
        `The '--tag' option has been removed. If you want to publish a package with a tag other than latest please set the 'release-plan.publishTag' setting in your package.json.`,
      );
    });

    it('adds tag if passed set in the solution', async function () {
      solution.set('thingy', {
        oldVersion: '3',
        newVersion: '4',
        impact: 'minor',
        constraints: [],
        tagName: 'best-tag',
        pkgJSONPath: './package.json',
      });

      await npmPublish(solution, reporter, {}, 'fake-npm');

      expect(execa).toBeCalledWith('fake-npm', ['publish', '--tag=best-tag'], {
        cwd: '.',
        stderr: 'inherit',
        stdout: 'inherit',
      });
    });

    it('adds dry-run if passed by options', async function () {
      await npmPublish(
        solution,
        reporter,
        {
          dryRun: true,
        },
        'fake-npm',
      );

      expect(execa).toBeCalledWith(
        'fake-npm',
        ['publish', '--dry-run', '--tag=latest'],
        {
          cwd: '.',
          stderr: 'inherit',
          stdout: 'inherit',
        },
      );
    });

    it('adds provenance if passed by options', async function () {
      await npmPublish(
        solution,
        reporter,
        {
          provenance: true,
        },
        'fake-npm',
      );

      expect(execa).toBeCalledWith(
        'fake-npm',
        ['publish', '--provenance', '--tag=latest'],
        {
          cwd: '.',
          stderr: 'inherit',
          stdout: 'inherit',
        },
      );
    });

    it('warns that a version exists if we are trying to release', async function () {
      const consoleSpy = vi.spyOn(process.stdout, 'write');

      await npmPublish(
        new Map([
          [
            'release-plan',
            {
              oldVersion: '0.8.1',
              newVersion: '0.9.0',
              impact: 'minor',
              pkgJSONPath: './package.json',
            },
          ],
        ]) as Solution,
        reporter,
        {},
        'face',
      );

      expect(consoleSpy.mock.lastCall?.[0]).toMatchInlineSnapshot(`
        "
         ℹ️ release-plan has already been published @ version 0.9.0. Skipping publish;"
      `);
      expect(execa).not.toHaveBeenCalled();
    });

    it('skips publishing if npmSkipPublish is specified in package.json', async function () {
      const consoleSpy = vi.spyOn(process.stdout, 'write');
      const packages = getPackages('./fixtures/pnpm/star-package');
      await npmPublish(
        new Map([
          [
            'do-not-publish',
            {
              oldVersion: '0.8.1',
              newVersion: '0.9.0',
              impact: 'minor',
              constraints: [],
              pkgJSONPath: packages.get('do-not-publish')?.pkgJSONPath,
              tagName: 'latest',
            },
          ],
          [
            'star-package',
            {
              oldVersion: '0.8.1',
              newVersion: '0.9.0',
              impact: 'minor',
              constraints: [],
              pkgJSONPath: packages.get('star-package')?.pkgJSONPath,
              tagName: 'latest',
            },
          ],
        ]) as Solution,
        reporter,
        {
          dryRun: true,
        },
        'fake-npm',
      );

      expect(consoleSpy.mock.lastCall?.[0]).toMatchInlineSnapshot(`
        "
         ℹ️ --dryRun active. Adding \`--dry-run\` flag to \`fake-npm publish\` for star-package, which would publish version 0.9.0
        "
      `);

      expect(execa).toHaveBeenCalledOnce();
      expect(execa).toBeCalledWith(
        'fake-npm',
        ['publish', '--dry-run', '--tag=latest'],
        {
          cwd: './fixtures/pnpm/star-package',
          stderr: 'inherit',
          stdout: 'inherit',
        },
      );
    });
  });

  describe('createGithubRelease', function () {
    it('calls octokit create Release with correct params', async function () {
      const octokit = {
        repos: {
          getReleaseByTag() {
            const err = new Error() as any;
            err.status = 404;
            throw err;
          },
          createRelease: vi.fn(),
        },
      };
      await createGithubRelease(
        octokit as any,
        'new release',
        'v1.0.0-release-plan',
        reporter,
        {},
      );
      expect(octokit.repos.createRelease.mock.calls.length).toBe(1);
      expect(octokit.repos.createRelease.mock.lastCall).toMatchInlineSnapshot(`
        [
          {
            "body": "new release",
            "name": "v1.0.0-release-plan",
            "owner": "release-plan",
            "prerelease": false,
            "repo": "release-plan",
            "tag_name": "v1.0.0-release-plan",
            "target_commitish": "test-sha",
          },
        ]
      `);
    });

    it('sets prerelease to true when githubPrerelease is set to true', async function () {
      const octokit = {
        repos: {
          getReleaseByTag() {
            const err = new Error() as any;
            err.status = 404;
            throw err;
          },
          createRelease: vi.fn(),
        },
      };
      await createGithubRelease(
        octokit as any,
        'new release',
        'v1.0.0-release-plan',
        reporter,
        {
          githubPrerelease: true,
        },
      );
      expect(octokit.repos.createRelease.mock.calls.length).toBe(1);
      expect(octokit.repos.createRelease.mock.lastCall).toMatchInlineSnapshot(`
        [
          {
            "body": "new release",
            "name": "v1.0.0-release-plan",
            "owner": "release-plan",
            "prerelease": true,
            "repo": "release-plan",
            "tag_name": "v1.0.0-release-plan",
            "target_commitish": "test-sha",
          },
        ]
      `);
    });
  });
});
