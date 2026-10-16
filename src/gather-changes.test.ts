import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { GitRepo } from './test-support/git-repo.js';
import { gatherChanges } from './gather-changes.js';
import { planVersionBumps } from './plan.js';

type Response = { status: number; body: unknown };
let responses: Record<string, Response> = {};

vi.mock('make-fetch-happen', () => ({
  default: async (url: string) => {
    const response = responses[url] ?? { status: 404, body: {} };
    return {
      status: response.status,
      statusText: response.status === 200 ? 'OK' : 'Not Found',
      ok: response.status === 200,
      json: () => Promise.resolve(response.body),
    };
  },
}));

const user = {
  login: 'luke',
  type: 'User',
  html_url: 'https://github.com/luke',
  name: 'Luke',
};

function pr(number: number, label?: string) {
  responses[`https://api.github.com/repos/test/repo/issues/${number}`] = {
    status: 200,
    body: {
      number,
      title: `PR ${number}`,
      labels: label ? [{ name: label }] : [],
      pull_request: { html_url: `https://github.com/test/repo/pull/${number}` },
      user,
    },
  };
}

function published(name: string, version: string) {
  responses[`https://registry.npmjs.org/${name}/${version}`] = {
    status: 200,
    body: { name, version },
  };
}

/**
 * Like the ember.js repo: the root package has its own release process,
 * and release-plan releases the packages in the workspace.
 */
describe('gatherChanges', function () {
  let repo: GitRepo;
  let realCwd: string;

  beforeEach(async () => {
    process.env.GITHUB_AUTH = 'test-token';
    responses = {
      'https://api.github.com/users/luke': { status: 200, body: user },
    };
    repo = await GitRepo.create();
    realCwd = process.cwd();
    process.chdir(repo.dir);

    await repo.commit('init', {
      'package.json': {
        name: 'root',
        version: '7.0.0',
        repository: 'https://github.com/test/repo',
        'release-plan': { ignore: true },
      },
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'packages/a/package.json': { name: 'a', version: '1.0.0' },
      'packages/b/package.json': { name: 'b', version: '1.0.0' },
      'packages/c/package.json': { name: 'c', version: '0.1.0' },
    });
  });

  afterEach(() => {
    process.chdir(realCwd);
    vi.resetAllMocks();
  });

  /**
   * a: released with a tag
   * b: released, no tag, no gitHead on npm
   * c: never published
   */
  async function history() {
    published('a', '1.1.0');
    published('b', '1.1.0');

    await repo.commit('old a (#1)', { 'packages/a/index.js': '1' });
    await repo.commit('old a and b (#2)', {
      'packages/a/index.js': '2',
      'packages/b/index.js': '2',
    });
    await repo.commit('Prepare Release a (#3)', {
      'packages/a/package.json': { name: 'a', version: '1.1.0' },
    });
    await repo.git('tag', 'v1.1.0-a');
    await repo.git('tag', 'v7.1.0-root');
    await repo.commit('a and b (#4)', {
      'packages/a/index.js': '4',
      'packages/b/index.js': '4',
    });
    await repo.commit('Prepare Release b (#5)', {
      'packages/b/package.json': { name: 'b', version: '1.1.0' },
    });
    await repo.commit('fix a (#6)', { 'packages/a/index.js': '6' });
    await repo.commit('root tooling (#7)', { 'tooling.js': '7' });
    await repo.commit('feature for c (#8)', { 'packages/c/index.js': '8' });

    pr(4, 'enhancement');
    pr(6, 'bug');
    pr(7);
    pr(8, 'enhancement');
  }

  it('finds the changes of each package since its own last release', async () => {
    await history();

    const { markdown, changes } = await gatherChanges();

    expect(changes.sections).toEqual([
      {
        heading: ':rocket: Enhancement',
        impact: 'minor',
        packages: ['c', 'a'],
      },
      { heading: ':bug: Bug Fix', impact: 'patch', packages: ['a'] },
    ]);
    for (const old of ['#1', '#2', '#3', '#5', '#7']) {
      expect(markdown).not.toContain(`[${old}]`);
    }
  });

  it('plans releases from git, without a changelog to parse', async () => {
    await history();

    const solution = planVersionBumps((await gatherChanges()).changes);

    expect(solution.get('a')).toMatchObject({ newVersion: '1.2.0' });
    expect(solution.get('b')).toMatchObject({ impact: undefined });
    expect(solution.get('c')).toMatchObject({ newVersion: '0.2.0' });
  });

  it('does not ask for labels on PRs that change no package in the release', async () => {
    await history();

    const { changes } = await gatherChanges();

    expect(changes.sections.some((s) => 'unlabeled' in s)).toBe(false);
  });

  it('asks for labels on PRs that change a package in the release', async () => {
    await history();
    await repo.commit('unlabeled change to b (#9)', {
      'packages/b/index.js': '9',
    });
    pr(9);

    const { changes } = await gatherChanges();

    expect(changes.sections).toContainEqual({
      unlabeled: true,
      summaryText: expect.stringContaining('[#9]'),
    });
    expect(
      changes.sections.find((s) => 'unlabeled' in s && s.unlabeled),
    ).not.toMatchObject({ summaryText: expect.stringContaining('[#7]') });
  });

  it('finds PRs that landed as merge commits', async () => {
    await history();
    await repo.git('checkout', '--quiet', '-b', 'feature');
    await repo.commit('work on b', { 'packages/b/index.js': '10' });
    await repo.git('checkout', '--quiet', 'main');
    await repo.git(
      'merge',
      '--quiet',
      '--no-ff',
      '-m',
      'Merge pull request #10 from feature',
      'feature',
    );
    pr(10, 'bug');

    const { changes } = await gatherChanges();

    expect(changes.sections).toContainEqual({
      heading: ':bug: Bug Fix',
      impact: 'patch',
      packages: ['b', 'a'],
    });
  });
});
