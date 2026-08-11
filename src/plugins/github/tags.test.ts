import { describe, it, expect, vi } from 'vitest';
import { githubTags } from './tags.js';
import type { Solution } from '../../plan.js';
import type {
  PluginAPI,
  ReleaseContext,
  PluginContext,
} from '../../plugin-types.js';
import { ReleaseError } from '../../plugin-types.js';

vi.stubEnv('GITHUB_SHA', 'test-sha');

const mockCreateRef = vi.fn();
const mockGetRef = vi.fn().mockImplementation(() => {
  const err = new Error() as any;
  err.status = 404;
  throw err;
});

vi.mock('./shared.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./shared.js')>();
  return {
    ...orig,
    createOctokit: vi.fn(() => ({
      git: {
        getRef: mockGetRef,
        createRef: mockCreateRef,
      },
    })),
  };
});

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

function makeRelease(solution: Solution, dryRun = false): ReleaseContext {
  return {
    solution,
    description: 'test release',
    dryRun,
  };
}

function makeContext(solution: Solution, dryRun = false): PluginContext {
  const entry = [...solution.values()].find((e) => e.impact)!;
  const name = [...solution.entries()].find(([, e]) => e.impact)![0];
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

describe('github-tags plugin', function () {
  it('shouldPublish returns false and logs when tag already exists', async function () {
    mockGetRef.mockImplementationOnce(() => ({ status: 200 }));
    const plugin = githubTags();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    const result = await plugin.shouldPublish.call(api, makeContext(solution));

    expect(result).toBe(false);
    expect(api.infos[0]).toContain('has already been pushed up');
    expect(mockCreateRef).not.toHaveBeenCalled();
  });

  it('shouldPublish returns true when tag does not exist', async function () {
    const plugin = githubTags();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    const result = await plugin.shouldPublish.call(api, makeContext(solution));

    expect(result).toBe(true);
  });

  it('skips tag creation in dryRun mode', async function () {
    mockCreateRef.mockClear();
    const plugin = githubTags();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish.call(api, makeContext(solution, true));

    expect(mockCreateRef).not.toHaveBeenCalled();
    expect(api.infos[0]).toContain('--dryRun active');
  });

  it('creates tag for package', async function () {
    mockCreateRef.mockClear();
    const plugin = githubTags();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish.call(api, makeContext(solution));

    expect(mockCreateRef).toHaveBeenCalledOnce();
    expect(mockCreateRef.mock.lastCall![0]).toMatchObject({
      owner: 'release-plan',
      repo: 'release-plan',
      ref: 'refs/tags/v1.0.0',
      type: 'commit',
    });
  });

  it('validate throws ReleaseError when GITHUB_AUTH is missing', async function () {
    const plugin = githubTags();
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

describe('tag format', function () {
  it('creates tags without package name suffix for single-package repos', async function () {
    const plugin = githubTags();
    const api = makeApi();
    const solution = new Map([
      [
        '@scope/my-package',
        {
          oldVersion: '1.0.0',
          newVersion: '1.1.0',
          impact: 'minor' as const,
          constraints: [],
          tagName: 'latest',
          pkgJSONPath: './package.json',
        },
      ],
    ]) as Solution;

    process.env.GITHUB_API_URL = 'https://api.github.com';
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish.call(api, makeContext(solution, true));

    const output = api.infos[0];
    expect(output).toContain('git tag v1.1.0`');
    expect(output).not.toContain('git tag v1.1.0-@scope/my-package');
  });

  it('creates tags with package name suffix for multi-package repos', async function () {
    const plugin = githubTags();
    const solution = new Map([
      [
        '@scope/pkg-a',
        {
          oldVersion: '1.0.0',
          newVersion: '1.1.0',
          impact: 'minor' as const,
          constraints: [],
          tagName: 'latest',
          pkgJSONPath: './package.json',
        },
      ],
      [
        '@scope/pkg-b',
        {
          oldVersion: '2.0.0',
          newVersion: '2.1.0',
          impact: 'minor' as const,
          constraints: [],
          tagName: 'latest',
          pkgJSONPath: './package.json',
        },
      ],
    ]) as Solution;

    // Call publish once per package (as the orchestrator would)
    for (const [name, entry] of solution) {
      if (!entry.impact) continue;
      const api = makeApi();
      const context: PluginContext = {
        release: makeRelease(solution, true),
        package: {
          name,
          oldVersion: entry.oldVersion,
          newVersion: (entry as any).newVersion,
          tagName: (entry as any).tagName,
          pkgJSONPath: (entry as any).pkgJSONPath,
        },
      };
      await plugin.publish.call(api, context);
      expect(api.infos[0]).toContain(
        `git tag v${(entry as any).newVersion}-${name}`,
      );
    }
  });
});
