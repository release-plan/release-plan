import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { GitRepo } from '../test-support/git-repo.js';
import { npmVersionInfo } from './npm.js';
import { findReleaseBase } from './release-base.js';

vi.mock('./npm.js', () => ({ npmVersionInfo: vi.fn() }));

const npm = vi.mocked(npmVersionInfo);

describe('findReleaseBase', function () {
  let repo: GitRepo;
  let realCwd: string;

  const a = {
    name: 'a',
    version: '1.1.0',
    pkgJSONPath: './packages/a/package.json',
  };

  beforeEach(async () => {
    repo = await GitRepo.create();
    realCwd = process.cwd();
    process.chdir(repo.dir);
    npm.mockResolvedValue({ published: true, gitHead: undefined });

    await repo.commit('init', {
      'package.json': { name: 'root', private: true },
      'packages/a/package.json': { name: 'a', version: '1.0.0' },
      'packages/b/package.json': { name: 'b', version: '1.0.0' },
    });
  });

  afterEach(() => {
    process.chdir(realCwd);
    vi.resetAllMocks();
  });

  async function releaseA() {
    return repo.commit('Prepare Release', {
      'packages/a/package.json': { name: 'a', version: '1.1.0' },
    });
  }

  it('uses the tag that publish made for the version of this package', async () => {
    const released = await releaseA();
    await repo.git('tag', 'v1.1.0-a');
    await repo.commit('later', { 'packages/a/index.js': '' });

    expect(await findReleaseBase(a, { suffixedTags: true })).toEqual({
      ref: released,
      source: 'tag',
    });
  });

  it('does not use the tag of another package', async () => {
    const released = await releaseA();
    await repo.commit('release b', {
      'packages/b/package.json': { name: 'b', version: '1.1.0' },
    });
    await repo.git('tag', 'v1.1.0-b');

    expect(await findReleaseBase(a, { suffixedTags: true })).toEqual({
      ref: released,
      source: 'version-commit',
    });
  });

  it('uses plain version tags in a repo with one package', async () => {
    const released = await releaseA();
    await repo.git('tag', 'v1.1.0');
    await repo.commit('later', { 'packages/a/index.js': '' });

    expect(await findReleaseBase(a, { suffixedTags: false })).toEqual({
      ref: released,
      source: 'tag',
    });
  });

  it('ignores a tag that is not in the history of HEAD', async () => {
    await repo.git('checkout', '--quiet', '-b', 'side');
    await releaseA();
    await repo.git('tag', 'v1.1.0-a');
    await repo.git('checkout', '--quiet', 'main');
    await repo.commit('other work', { 'packages/b/index.js': '' });
    const released = await releaseA();

    expect(await findReleaseBase(a, { suffixedTags: true })).toEqual({
      ref: released,
      source: 'version-commit',
    });
  });

  it('uses the gitHead from npm when there is no tag', async () => {
    const released = await releaseA();
    await repo.commit('later', { 'packages/a/index.js': '' });
    npm.mockResolvedValue({ published: true, gitHead: released });

    expect(await findReleaseBase(a, { suffixedTags: true })).toEqual({
      ref: released,
      source: 'npm-git-head',
    });
    expect(npm).toHaveBeenCalledWith('a', '1.1.0');
  });

  it('uses the commit that set the version when npm has no gitHead', async () => {
    const released = await releaseA();
    await repo.commit('later', { 'packages/a/index.js': '' });

    expect(await findReleaseBase(a, { suffixedTags: true })).toEqual({
      ref: released,
      source: 'version-commit',
    });
  });

  it('uses the merge commit when the release PR landed as a merge', async () => {
    await repo.git('checkout', '--quiet', '-b', 'release-preview');
    await releaseA();
    await repo.git('checkout', '--quiet', 'main');
    await repo.commit('other work', { 'packages/b/index.js': '' });
    await repo.git(
      'merge',
      '--quiet',
      '--no-ff',
      '-m',
      'Merge pull request #9 from release-preview',
      'release-preview',
    );
    const merge = await repo.git('rev-parse', 'HEAD');
    await repo.commit('later', { 'packages/a/index.js': '' });

    expect(await findReleaseBase(a, { suffixedTags: true })).toEqual({
      ref: merge,
      source: 'version-commit',
    });
  });

  it('treats all history as unreleased when npm does not have the version', async () => {
    await releaseA();
    await repo.git('tag', 'v1.1.0-a');
    npm.mockResolvedValue({ published: false });

    expect(
      await findReleaseBase(
        { ...a, name: 'c', pkgJSONPath: './packages/c/package.json' },
        { suffixedTags: true },
      ),
    ).toEqual({ ref: undefined, source: 'never-released' });
  });

  it('still finds the version commit when npm does not answer', async () => {
    const released = await releaseA();
    npm.mockResolvedValue(undefined);

    expect(await findReleaseBase(a, { suffixedTags: true })).toEqual({
      ref: released,
      source: 'version-commit',
    });
  });
});
