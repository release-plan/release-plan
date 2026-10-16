import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

import * as git from './git.js';
import Changelog from './changelog.js';
import type { Configuration } from './configuration.js';

vi.mock('./git.js', () => ({
  lastTag: vi.fn(),
  listCommits: vi.fn(),
  changedPaths: vi.fn(),
  getRootPath: vi.fn(),
}));

type MockResponse = {
  status?: number;
  statusText?: string;
  ok?: boolean;
  body: unknown;
};

let mockResponses: Record<string, MockResponse> = {};

vi.mock('make-fetch-happen', () => ({
  default: async (url: string) => {
    const response = mockResponses[url];
    if (!response) {
      throw new Error(`Unknown URL: ${url}`);
    }
    return {
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      ok: response.ok ?? true,
      json: () => Promise.resolve(response.body),
    };
  },
}));

const ROOT = '/repo';

const defaultConfig: Configuration = {
  rootPath: ROOT,
  repo: 'embroider-build/github-changelog',
  labels: {
    'Type: New Feature': ':rocket: New Feature',
    'Type: Breaking Change': ':boom: Breaking Change',
    'Type: Bug': ':bug: Bug Fix',
    'Type: Enhancement': ':nail_care: Enhancement',
    'Type: Documentation': ':memo: Documentation',
    'Type: Maintenance': ':house: Maintenance',
  },
  ignoreCommitters: [],
  ignoreLabel: 'ignore',
  nextVersion: 'Unreleased',
  packages: [],
};

const fixturePackages = [
  'random',
  'a-new-hope',
  'empire-strikes-back',
  'return-of-the-jedi',
  'the-force-awakens',
  'rogue-one',
  'untitled',
].map((name) => ({ name, path: `${ROOT}/packages/${name}` }));

class TestChangelog extends Changelog {
  constructor(config: Partial<Configuration> = {}) {
    super({ ...defaultConfig, ...config });
  }

  protected getToday() {
    return '2099-01-01';
  }
}

const mocked = {
  lastTag: vi.mocked(git.lastTag),
  listCommits: vi.mocked(git.listCommits),
  changedPaths: vi.mocked(git.changedPaths),
};

const listOfCommits = [
  {
    sha: 'a0000017',
    refName: '',
    summary: 'Merge pull request #8 from my-dependency',
    date: '2017-01-01',
  },
  {
    sha: 'a0000016',
    refName: '',
    summary: 'chore: Update dependency',
    date: '2017-01-01',
  },
  {
    sha: 'a0000015',
    refName: '',
    summary: 'chore: making of episode viii',
    date: '2015-12-18',
  },
  {
    sha: 'a0000014',
    refName: '',
    summary: 'feat: infiltration (#7)',
    date: '2015-12-18',
  },
  {
    sha: 'a0000013',
    refName: 'HEAD -> master, tag: v6.0.0, origin/master, origin/HEAD',
    summary: 'chore(release): releasing component',
    date: '1983-05-25',
  },
  {
    sha: 'a0000012',
    refName: '',
    summary: 'Merge pull request #6 from return-of-the-jedi',
    date: '1983-05-25',
  },
  {
    sha: 'a0000011',
    refName: '',
    summary: 'feat: I am your father (#5)',
    date: '1983-05-25',
  },
  {
    sha: 'a0000010',
    refName: '',
    summary: 'fix(han-solo): unfreezes (#4)',
    date: '1983-05-25',
  },
  {
    sha: 'a0000009',
    refName: 'tag: v5.0.0',
    summary: 'chore(release): releasing component',
    date: '1980-05-17',
  },
  {
    sha: 'a0000008',
    refName: '',
    summary: 'Merge pull request #3 from empire-strikes-back',
    date: '1980-05-17',
  },
  {
    sha: 'a0000007',
    refName: '',
    summary: 'fix: destroy rebels base',
    date: '1980-05-17',
  },
  {
    sha: 'a0000006',
    refName: '',
    summary: 'chore: the end of Alderaan (#2)',
    date: '1980-05-17',
  },
  {
    sha: 'a0000005',
    refName: '',
    summary: 'refactor(death-star): add deflector shield',
    date: '1980-05-17',
  },
  {
    sha: 'a0000004',
    refName: 'tag: v4.0.0',
    summary: 'chore(release): releasing component',
    date: '1977-05-25',
  },
  {
    sha: 'a0000003',
    refName: '',
    summary: 'Merge pull request #1 from star-wars',
    date: '1977-05-25',
  },
  {
    sha: 'a0000002',
    refName: 'tag: v0.1.0',
    summary: 'chore(release): releasing component',
    date: '1966-01-01',
  },
  {
    sha: 'a0000001',
    refName: '',
    summary: 'fix: some random fix which will be ignored',
    date: '1966-01-01',
  },
];

const listOfPackagesForEachCommit: Record<string, string[]> = {
  a0000001: ['packages/random/foo.js'],
  a0000002: ['packages/random/package.json'],
  a0000003: ['packages/a-new-hope/rebels.js'],
  a0000004: ['packages/a-new-hope/package.json'],
  a0000005: ['packages/empire-strikes-back/death-star.js'],
  a0000006: ['packages/empire-strikes-back/death-star.js'],
  a0000007: ['packages/empire-strikes-back/hoth.js'],
  a0000008: ['packages/empire-strikes-back/hoth.js'],
  a0000009: ['packages/empire-strikes-back/package.json'],
  a0000010: ['packages/return-of-the-jedi/jabba-the-hutt.js'],
  a0000011: ['packages/return-of-the-jedi/vader-luke.js'],
  a0000012: ['packages/return-of-the-jedi/leia.js'],
  a0000013: ['packages/return-of-the-jedi/package.json'],
  a0000014: [
    'packages/the-force-awakens/mission.js',
    'packages/rogue-one/mission.js',
  ],
  a0000015: ['packages/untitled/script.md'],
  a0000016: ['packages/return-of-the-jedi/package.json'],
  a0000017: ['packages/return-of-the-jedi/package.json'],
};

const listOfFileForEachCommit: Record<string, string[]> = {
  a0000001: ['random/foo.js'],
  a0000002: ['random/package.json'],
  a0000003: ['a-new-hope/rebels.js'],
  a0000004: ['a-new-hope/package.json'],
  a0000005: ['empire-strikes-back/death-star.js'],
  a0000006: ['empire-strikes-back/death-star.js'],
  a0000007: ['empire-strikes-back/hoth.js'],
  a0000008: ['empire-strikes-back/hoth.js'],
  a0000009: ['empire-strikes-back/package.json'],
  a0000010: ['return-of-the-jedi/jabba-the-hutt.js'],
  a0000011: ['return-of-the-jedi/vader-luke.js'],
  a0000012: ['return-of-the-jedi/leia.js'],
  a0000013: ['return-of-the-jedi/package.json'],
  a0000014: ['the-force-awakens/mission.js', 'rogue-one/mission.js'],
  a0000015: ['untitled/script.md'],
  a0000016: ['packages/return-of-the-jedi/package.json'],
  a0000017: ['packages/return-of-the-jedi/package.json'],
};

const usersCache: Record<string, MockResponse> = {
  'https://api.github.com/users/luke': {
    body: {
      login: 'luke',
      type: 'User',
      html_url: 'https://github.com/luke',
      name: 'Luke Skywalker',
    },
  },
  'https://api.github.com/users/princess-leia': {
    body: {
      login: 'princess-leia',
      type: 'User',
      html_url: 'https://github.com/princess-leia',
      name: 'Princess Leia Organa',
    },
  },
  'https://api.github.com/users/vader': {
    body: {
      login: 'vader',
      type: 'User',
      html_url: 'https://github.com/vader',
      name: 'Darth Vader',
    },
  },
  'https://api.github.com/users/gtarkin': {
    body: {
      login: 'gtarkin',
      type: 'User',
      html_url: 'https://github.com/gtarkin',
      name: 'Governor Tarkin',
    },
  },
  'https://api.github.com/users/han-solo': {
    body: {
      login: 'han-solo',
      type: 'User',
      html_url: 'https://github.com/han-solo',
      name: 'Han Solo',
    },
  },
  'https://api.github.com/users/chewbacca': {
    body: {
      login: 'chewbacca',
      type: 'User',
      html_url: 'https://github.com/chewbacca',
      name: 'Chwebacca',
    },
  },
  'https://api.github.com/users/rd-d2': {
    body: {
      login: 'rd-d2',
      type: 'User',
      html_url: 'https://github.com/rd-d2',
      name: 'R2-D2',
    },
  },
  'https://api.github.com/users/c-3po': {
    body: {
      login: 'c-3po',
      type: 'User',
      html_url: 'https://github.com/c-3po',
      name: 'C-3PO',
    },
  },
  'https://api.github.com/users/bot-user': {
    body: {
      login: 'bot-user',
      html_url: 'https://github.com/bot-user',
      name: 'Bot User',
    },
  },
};
const issuesCache: Record<string, MockResponse> = {
  'https://api.github.com/repos/embroider-build/github-changelog/issues/1': {
    body: {
      number: 1,
      title: 'feat: May the force be with you',
      labels: [{ name: 'Type: New Feature' }],
      pull_request: {
        html_url: 'https://github.com/embroider-build/github-changelog/pull/1',
      },
      user: usersCache['https://api.github.com/users/luke'].body,
    },
  },
  'https://api.github.com/repos/embroider-build/github-changelog/issues/2': {
    body: {
      number: 2,
      title: 'chore: Terminate her... immediately!',
      labels: [{ name: 'Type: Breaking Change' }],
      pull_request: {
        html_url: 'https://github.com/embroider-build/github-changelog/pull/2',
      },
      user: usersCache['https://api.github.com/users/gtarkin'].body,
    },
  },
  'https://api.github.com/repos/embroider-build/github-changelog/issues/3': {
    body: {
      number: 3,
      title: 'fix: Get me the rebels base!',
      labels: [{ name: 'Type: Bug' }],
      pull_request: {
        html_url: 'https://github.com/embroider-build/github-changelog/pull/3',
      },
      user: usersCache['https://api.github.com/users/vader'].body,
    },
  },
  'https://api.github.com/repos/embroider-build/github-changelog/issues/4': {
    body: {
      number: 4,
      title: 'fix: RRRAARRWHHGWWR',
      labels: [{ name: 'Type: Bug' }, { name: 'Type: Maintenance' }],
      pull_request: {
        html_url: 'https://github.com/embroider-build/github-changelog/pull/4',
      },
      user: usersCache['https://api.github.com/users/chewbacca'].body,
    },
  },
  'https://api.github.com/repos/embroider-build/github-changelog/issues/5': {
    body: {
      number: 5,
      title: 'feat: I am your father',
      labels: [{ name: 'Type: New Feature' }],
      pull_request: {
        html_url: 'https://github.com/embroider-build/github-changelog/pull/5',
      },
      user: usersCache['https://api.github.com/users/vader'].body,
    },
  },
  'https://api.github.com/repos/embroider-build/github-changelog/issues/6': {
    body: {
      number: 6,
      title: 'refactor: he is my brother',
      labels: [{ name: 'Type: Enhancement' }],
      pull_request: {
        html_url: 'https://github.com/embroider-build/github-changelog/pull/6',
      },
      user: usersCache['https://api.github.com/users/princess-leia'].body,
    },
  },
  'https://api.github.com/repos/embroider-build/github-changelog/issues/7': {
    body: {
      number: 7,
      title: 'feat: that is not how the Force works!',
      labels: [{ name: 'Type: New Feature' }, { name: 'Type: Enhancement' }],
      pull_request: {
        html_url: 'https://github.com/embroider-build/github-changelog/pull/7',
      },
      user: usersCache['https://api.github.com/users/han-solo'].body,
    },
  },
  'https://api.github.com/repos/embroider-build/github-changelog/issues/8': {
    body: {
      number: 8,
      title: 'This is the commit title for the issue (#8)',
      labels: [{ name: 'Type: Maintenance' }, { name: 'Status: In Progress' }],
      user: {
        login: 'bot-user',
        html_url: 'https://github.com/bot-user',
        name: 'Bot User',
      },
    },
  },
};

describe('createMarkdown', () => {
  beforeEach(() => {
    process.env.GITHUB_AUTH = 'test-token';
    mockResponses = {};
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function useFixtures(paths: Record<string, string[]>) {
    mocked.changedPaths.mockImplementation(async (sha) => paths[sha]);
    mocked.lastTag.mockImplementation(() => 'v8.0.0');
    mocked.listCommits.mockImplementation(() => listOfCommits);
    mockResponses = { ...usersCache, ...issuesCache };
  }

  describe('ignore config', () => {
    it('ignores PRs from bot users even if they were not the (merge) committer', async () => {
      useFixtures(listOfPackagesForEachCommit);

      const changelog = new TestChangelog({
        ignoreCommitters: ['bot-user'],
        packages: fixturePackages,
      });

      const markdown = await changelog.createMarkdown();

      expect(markdown).toMatchSnapshot();
    });
  });

  describe('single tags', () => {
    it('outputs correct changelog', async () => {
      useFixtures(listOfPackagesForEachCommit);

      const changelog = new TestChangelog({ packages: fixturePackages });

      const markdown = await changelog.createMarkdown();

      expect(markdown).toMatchSnapshot();
    });
  });

  describe('multiple tags', () => {
    it('outputs correct changelog', async () => {
      useFixtures(listOfPackagesForEachCommit);
      mocked.listCommits.mockImplementation(() => [
        {
          sha: 'a0000004',
          refName:
            'tag: a-new-hope@4.0.0, tag: empire-strikes-back@5.0.0, tag: return-of-the-jedi@6.0.0',
          summary: 'chore(release): releasing component',
          date: '1977-05-25',
        },
        {
          sha: 'a0000003',
          refName: '',
          summary: 'Merge pull request #1 from star-wars',
          date: '1977-05-25',
        },
        {
          sha: 'a0000002',
          refName: 'tag: v0.1.0',
          summary: 'chore(release): releasing component',
          date: '1966-01-01',
        },
        {
          sha: 'a0000001',
          refName: '',
          summary: 'fix: some random fix which will be ignored',
          date: '1966-01-01',
        },
      ]);

      const changelog = new TestChangelog({ packages: fixturePackages });

      const markdown = await changelog.createMarkdown();

      expect(markdown).toMatchSnapshot();
    });
  });

  describe('single project', () => {
    it('outputs correct changelog', async () => {
      useFixtures(listOfFileForEachCommit);

      const changelog = new TestChangelog({ packages: fixturePackages });

      const markdown = await changelog.createMarkdown();

      expect(markdown).toMatchSnapshot();
    });
  });

  describe('ignoreReleases', () => {
    it('collapses everything into the next release', async () => {
      useFixtures(listOfPackagesForEachCommit);

      const changelog = new TestChangelog({
        packages: fixturePackages,
        ignoreReleases: true,
        nextVersion: 'Release',
      });

      const markdown = await changelog.createMarkdown();

      expect(markdown).toMatchSnapshot();
    });
  });

  describe('package attribution', () => {
    it('attributes files outside every nested package to a published root', async () => {
      useFixtures(listOfPackagesForEachCommit);

      const changelog = new TestChangelog({
        packages: [
          { name: 'root', path: ROOT },
          ...fixturePackages.filter((p) => p.name === 'a-new-hope'),
        ],
        ignoreReleases: true,
        nextVersion: 'Release',
      });

      const markdown = await changelog.createMarkdown();

      expect(markdown).toContain('* `a-new-hope`');
      expect(markdown).toContain('* `root`');
      expect(markdown).not.toContain('* Other');
    });

    it('does not confuse packages that share a path prefix', async () => {
      useFixtures({
        a0000003: ['packages/a-new-hope-2/rebels.js'],
      });
      mocked.listCommits.mockImplementation(() => [
        {
          sha: 'a0000003',
          refName: '',
          summary: 'Merge pull request #1 from star-wars',
          date: '1977-05-25',
        },
      ]);

      const changelog = new TestChangelog({
        packages: [
          { name: 'a-new-hope', path: `${ROOT}/packages/a-new-hope` },
          { name: 'a-new-hope-2', path: `${ROOT}/packages/a-new-hope-2` },
        ],
      });

      const markdown = await changelog.createMarkdown();

      expect(markdown).toContain('* `a-new-hope-2`');
      expect(markdown).not.toContain('* `a-new-hope`\n');
    });
  });

  describe('authentication', () => {
    describe('when github token is not valid', () => {
      const badCredentials = {
        message: 'Bad credentials',
        documentation_url: 'https://developer.github.com/v3',
      };

      it('aborts with the GitHub error message', async () => {
        useFixtures(listOfFileForEachCommit);
        const unauthorized = {
          status: 401,
          statusText: 'Unauthorized',
          ok: false,
          body: badCredentials,
        };
        mockResponses = {
          ...usersCache,
          ...Object.fromEntries(
            Object.keys(issuesCache).map((issue) => [issue, unauthorized]),
          ),
        };

        const changelog = new TestChangelog();
        await expect(changelog.createMarkdown()).rejects.toMatchObject({
          message: expect.stringContaining('Fetch error: Unauthorized'),
        });
        await expect(changelog.createMarkdown()).rejects.toMatchObject({
          message: expect.stringContaining(JSON.stringify(badCredentials)),
        });
      });
    });
  });
});
