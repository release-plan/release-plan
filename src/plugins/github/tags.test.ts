import { describe, it, expect, vi } from 'vitest';
import { githubTags } from './tags.js';
import type { Solution } from '../../plan.js';
import type { PluginAPI, PublishContext } from '../../plugin-types.js';
import { UserError } from '../../plugin-types.js';

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

function makeContext(solution: Solution, dryRun = false): PublishContext {
  return {
    solution,
    description: 'test release',
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

describe('github-tags plugin', function () {
  it('skips tag creation in dryRun mode', async function () {
    const plugin = githubTags();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish(makeContext(solution, true), api);

    expect(mockCreateRef).not.toHaveBeenCalled();
    expect(api.infos[0]).toContain('--dryRun active');
  });

  it('creates tag for packages with impact', async function () {
    mockCreateRef.mockClear();
    const plugin = githubTags();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish(makeContext(solution), api);

    expect(mockCreateRef).toHaveBeenCalledOnce();
    expect(mockCreateRef.mock.lastCall![0]).toMatchObject({
      owner: 'release-plan',
      repo: 'release-plan',
      ref: 'refs/tags/v1.0.0',
      type: 'commit',
    });
  });

  it('skips packages without impact', async function () {
    mockCreateRef.mockClear();
    const plugin = githubTags();
    const api = makeApi();
    const solution: Solution = new Map([
      [
        'unchanged-pkg',
        {
          oldVersion: '1.0.0',
          impact: undefined,
        },
      ],
    ]);
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish(makeContext(solution), api);

    expect(mockCreateRef).not.toHaveBeenCalled();
  });

  it('skips tag if it already exists', async function () {
    mockCreateRef.mockClear();
    mockGetRef.mockImplementationOnce(() => ({ status: 200 }));
    const plugin = githubTags();
    const api = makeApi();
    const solution = makeSolution();
    process.env.GITHUB_AUTH = 'auth';

    await plugin.publish(makeContext(solution), api);

    expect(mockCreateRef).not.toHaveBeenCalled();
    expect(api.infos[0]).toContain('has already been pushed up');
  });

  it('validate throws UserError when GITHUB_AUTH is missing', async function () {
    const plugin = githubTags();
    const api = makeApi();
    const solution = makeSolution();
    const savedAuth = process.env.GITHUB_AUTH;
    delete process.env.GITHUB_AUTH;

    try {
      await expect(plugin.validate!(makeContext(solution), api)).rejects.toThrow(
        api.UserError,
      );
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

    await plugin.publish(makeContext(solution, true), api);

    const output = api.infos[0];

    expect(output).toContain('git tag v1.1.0`');
    expect(output).not.toContain('git tag v1.1.0-@scope/my-package');
  });

  it('creates tags with package name suffix for multi-package repos', async function () {
    const plugin = githubTags();
    const api = makeApi();
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

    await plugin.publish(makeContext(solution, true), api);

    expect(api.infos[0]).toContain('git tag v1.1.0-@scope/pkg-a');
    expect(api.infos[1]).toContain('git tag v2.1.0-@scope/pkg-b');
  });
});
