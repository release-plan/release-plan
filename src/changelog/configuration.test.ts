import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

import { findRepoFromPkg, fromPath } from './configuration.js';
import ConfigurationError from './configuration-error.js';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function writeJson(file: string, content: unknown) {
  fs.writeFileSync(file, JSON.stringify(content));
}

describe('Configuration', function () {
  describe('fromPath', function () {
    let tmpDir: string;

    beforeEach(function () {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-test-'));
    });

    afterEach(function () {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("reads the options from the 'release-plan' key of 'package.json'", function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': {
          repo: 'foo/bar',
          ignoreCommitters: ['bot'],
          labels: { feature: ':rocket: Enhancement' },
        },
      });

      const result = fromPath(tmpDir);
      expect(result.repo).toEqual('foo/bar');
      expect(result.ignoreCommitters).toEqual(['bot']);
      expect(result.labels).toMatchObject({ feature: ':rocket: Enhancement' });
    });

    it('reads only repo options next to the package options of the root package', function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': {
          repo: 'foo/bar',
          ignore: true,
          semverIncrementAs: { major: 'minor' },
        },
      });

      const result = fromPath(tmpDir) as unknown as Record<string, unknown>;
      expect(result.repo).toEqual('foo/bar');
      expect(result).not.toHaveProperty('ignore');
      expect(result).not.toHaveProperty('semverIncrementAs');
    });

    it("still reads the deprecated 'changelog' key, with a warning", function () {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      writeJson(path.join(tmpDir, 'package.json'), {
        changelog: { repo: 'foo/bar', ignoreLabel: 'skip' },
      });

      const result = fromPath(tmpDir);
      expect(result.repo).toEqual('foo/bar');
      expect(result.ignoreLabel).toEqual('skip');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '"changelog" key in package.json is deprecated',
        ),
      );
      warn.mockRestore();
    });

    it("prefers the 'release-plan' key over the 'changelog' key", function () {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      writeJson(path.join(tmpDir, 'package.json'), {
        changelog: { repo: 'foo/old', ignoreLabel: 'skip' },
        'release-plan': { repo: 'foo/new' },
      });

      const result = fromPath(tmpDir);
      expect(result.repo).toEqual('foo/new');
      expect(result.ignoreLabel).toEqual('skip');
      warn.mockRestore();
    });

    it("does not read 'lerna.json'", function () {
      writeJson(path.join(tmpDir, 'lerna.json'), {
        changelog: { repo: 'foo/lerna' },
      });
      writeJson(path.join(tmpDir, 'package.json'), {
        repository: 'https://github.com/foo/package',
      });

      expect(fromPath(tmpDir).repo).toEqual('foo/package');
    });

    it("throws ConfigurationError if 'package.json' does not exist", function () {
      expect(() => fromPath(tmpDir)).toThrowError(ConfigurationError);
    });

    it('takes the next version from the caller only', function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': { repo: 'foo/bar', nextVersion: 'next' },
      });

      expect(fromPath(tmpDir).nextVersion).toBeUndefined();
      expect(fromPath(tmpDir, { nextVersion: 'Release' }).nextVersion).toEqual(
        'Release',
      );
    });

    it('fills in the default labels and ignores no committers', function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        'release-plan': { repo: 'foo/bar' },
      });
      const result = fromPath(tmpDir);
      expect(result.labels).toEqual({
        breaking: ':boom: Breaking Change',
        enhancement: ':rocket: Enhancement',
        bug: ':bug: Bug Fix',
        documentation: ':memo: Documentation',
        internal: ':house: Internal',
        '_github-changelog_unlabeled_': ':present: Additional updates',
      });
      expect(result.ignoreLabel).toEqual('ignore');
      expect(result.ignoreCommitters).toEqual([]);
    });
  });

  describe('findRepoFromPkg', function () {
    const tests = [
      [
        'git+https://github.com/ember-cli/ember-rfc176-data.git',
        'ember-cli/ember-rfc176-data',
      ],
      [
        'https://github.com/ember-cli/ember-rfc176-data.git',
        'ember-cli/ember-rfc176-data',
      ],
      ['https://github.com/babel/ember-cli-babel', 'babel/ember-cli-babel'],
      ['https://github.com/babel/ember-cli-babel.git', 'babel/ember-cli-babel'],
      [
        'https://github.host.com/babel/ember-cli-babel.git',
        'babel/ember-cli-babel',
      ],
      ['git@github.com:babel/ember-cli-babel.git', 'babel/ember-cli-babel'],
      [
        'git@github.host.com:babel/ember-cli-babel.git',
        'babel/ember-cli-babel',
      ],
      ['https://github.com/emberjs/ember.js.git', 'emberjs/ember.js'],
      ['https://gitlab.com/gnachman/iterm2.git', 'gnachman/iterm2'],
      ['git@gitlab.com:gnachman/iterm2.git', 'gnachman/iterm2'],
    ];

    tests.forEach(([input, output]) => {
      it(`'${input}' -> '${output}'`, function () {
        expect(
          findRepoFromPkg({
            repository: {
              url: input,
            },
          }),
        ).toEqual(output);
      });
    });

    it(`works with shorthand 'repository' syntax`, function () {
      expect(
        findRepoFromPkg({
          repository: 'https://github.com/babel/ember-cli-babel',
        }),
      ).toEqual('babel/ember-cli-babel');
    });
  });
});
