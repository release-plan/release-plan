import { describe, it, expect, vi } from 'vitest';
import { githubRelease } from './release.js';
import type { Solution } from '../../plan.js';
import type { PluginAPI, PublishContext } from '../../plugin-types.js';
import { UserError } from '../../plugin-types.js';

vi.stubEnv('GITHUB_SHA', 'test-sha');

// Mock createOctokit so we can inject a fake octokit
const mockCreateRelease = vi.fn();
vi.mock('./shared.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./shared.js')>();
  return {
    ...orig,
    createOctokit: vi.fn(() => ({
      repos: {
        getReleaseByTag() {
          const err = new Error() as any;
          err.status = 404;
          throw err;
        },
        createRelease: mockCreateRelease,
      },
    })),
  };
});

function makeContext(solution: Solution, dryRun = false): PublishContext {
  return {
    solution,
    description: 'new release',
    dryRun,
  };
}

function makeApi(): PluginAPI & {
  failures: string[];
  infos: string[];
  successes: string[];
} {
  const failures: string[] = [];
  const infos: string[] = [];
  const successes: string[] = [];
  return {
    UserError,
    reportFailure: (msg: string) => failures.push(msg),
    info: (msg: string) => infos.push(msg),
    success: (msg: string) => successes.push(msg),
    failures,
    infos,
    successes,
  };
}

function makeSolution(): Solution {
  return new Map([
    [
      'release-plan',
      {
        oldVersion: '0.9.0',
        newVersion: '1.0.0',
        impact: 'major' as const,
        constraints: [],
        tagName: 'latest',
        pkgJSONPath: './package.json',
      },
    ],
  ]);
}

describe('github-release plugin', function () {
  it('calls octokit createRelease with correct params', async function () {
    const plugin = githubRelease();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish(makeContext(solution), api);

    expect(mockCreateRelease.mock.calls.length).toBe(1);
    expect(mockCreateRelease.mock.lastCall).toMatchInlineSnapshot(`
      [
        {
          "body": "new release",
          "name": "v1.0.0",
          "owner": "release-plan",
          "prerelease": false,
          "repo": "release-plan",
          "tag_name": "v1.0.0",
          "target_commitish": "test-sha",
        },
      ]
    `);
  });

  it('sets prerelease to true when option is set', async function () {
    mockCreateRelease.mockClear();
    const plugin = githubRelease({ prerelease: true });
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish(makeContext(solution), api);

    expect(mockCreateRelease.mock.calls.length).toBe(1);
    expect(mockCreateRelease.mock.lastCall).toMatchInlineSnapshot(`
      [
        {
          "body": "new release",
          "name": "v1.0.0",
          "owner": "release-plan",
          "prerelease": true,
          "repo": "release-plan",
          "tag_name": "v1.0.0",
          "target_commitish": "test-sha",
        },
      ]
    `);
  });

  it('skips creating release in dryRun mode', async function () {
    mockCreateRelease.mockClear();
    const plugin = githubRelease();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish(makeContext(solution, true), api);

    expect(mockCreateRelease).not.toHaveBeenCalled();
    expect(api.infos[0]).toContain('--dryRun active');
  });

  it('prepare throws UserError when GITHUB_AUTH is missing', async function () {
    const plugin = githubRelease();
    const api = makeApi();
    const solution = makeSolution();
    const savedAuth = process.env.GITHUB_AUTH;
    delete process.env.GITHUB_AUTH;

    try {
      await expect(plugin.prepare!(makeContext(solution), api)).rejects.toThrow(
        api.UserError,
      );
    } finally {
      if (savedAuth) process.env.GITHUB_AUTH = savedAuth;
    }
  });
});
