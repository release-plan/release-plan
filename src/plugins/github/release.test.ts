import { describe, it, expect, vi } from 'vitest';
import { githubRelease } from './release.js';
import type { Solution } from '../../plan.js';
import type {
  PluginAPI,
  ReleaseContext,
  PluginContext,
} from '../../plugin-types.js';
import { ReleaseError } from '../../plugin-types.js';

vi.stubEnv('GITHUB_SHA', 'test-sha');

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

function makeRelease(solution: Solution, dryRun = false): ReleaseContext {
  return {
    solution,
    description: 'new release',
    dryRun,
  };
}

function makeContext(solution: Solution, dryRun = false): PluginContext {
  // Use the first package with impact as the package context
  const [name, entry] = [...solution.entries()].find(([, e]) => e.impact)!;
  return {
    release: makeRelease(solution, dryRun),
    package: {
      name,
      oldVersion: entry.oldVersion,
      newVersion: (entry as any).newVersion,
      tagName: (entry as any).tagName,
      pkgJSONPath: (entry as any).pkgJSONPath,
    },
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
    releaseError(message: string): never {
      throw new ReleaseError(message);
    },
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
  it('shouldPublish returns false for non-representative package', async function () {
    const solution = new Map([
      [
        'pkg-a',
        {
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
          impact: 'major' as const,
          constraints: [],
          tagName: 'latest',
          pkgJSONPath: './packages/pkg-a/package.json',
        },
      ],
      [
        'pkg-b',
        {
          oldVersion: '1.0.0',
          newVersion: '1.1.0',
          impact: 'minor' as const,
          constraints: [],
          tagName: 'latest',
          pkgJSONPath: './packages/pkg-b/package.json',
        },
      ],
    ]) as Solution;

    const plugin = githubRelease();
    const api = makeApi();
    process.env.GITHUB_AUTH = 'auth';

    // pkg-b is not the representative (pkg-a is first with impact)
    const context: PluginContext = {
      release: makeRelease(solution),
      package: {
        name: 'pkg-b',
        oldVersion: '1.0.0',
        newVersion: '1.1.0',
        tagName: 'latest',
        pkgJSONPath: './packages/pkg-b/package.json',
      },
    };

    const result = await plugin.shouldPublish.call(api, context);
    expect(result).toBe(false);
  });

  it('shouldPublish returns false when release already exists', async function () {
    const { createOctokit } = await import('./shared.js');
    vi.mocked(createOctokit).mockReturnValueOnce({
      repos: {
        getReleaseByTag: vi.fn(() => ({ status: 200 })),
        createRelease: mockCreateRelease,
      },
    } as any);

    const plugin = githubRelease();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    const result = await plugin.shouldPublish.call(api, makeContext(solution));
    expect(result).toBe(false);
    expect(api.infos[0]).toContain('already exists');
  });

  it('shouldPublish returns true for representative package when release does not exist', async function () {
    const plugin = githubRelease();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    const result = await plugin.shouldPublish.call(api, makeContext(solution));
    expect(result).toBe(true);
  });

  it('calls octokit createRelease with correct params', async function () {
    mockCreateRelease.mockClear();
    const plugin = githubRelease();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish.call(api, makeContext(solution));

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

    await plugin.publish.call(api, makeContext(solution));

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

    await plugin.publish.call(api, makeContext(solution, true));

    expect(mockCreateRelease).not.toHaveBeenCalled();
    expect(api.infos[0]).toContain('--dryRun active');
  });

  it('validate throws ReleaseError when GITHUB_AUTH is missing', async function () {
    const plugin = githubRelease();
    const api = makeApi();
    const savedAuth = process.env.GITHUB_AUTH;
    delete process.env.GITHUB_AUTH;

    try {
      await expect(plugin.validate.call(api)).rejects.toThrow(ReleaseError);
    } finally {
      if (savedAuth) process.env.GITHUB_AUTH = savedAuth;
    }
  });
});
