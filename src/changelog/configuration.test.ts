import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

import { findRepoFromPkg, fromPath } from './configuration.js';
import ConfigurationError from './configuration-error.js';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

    it("reads the configuration from 'lerna.json'", function () {
      writeJson(path.join(tmpDir, 'lerna.json'), {
        changelog: { repo: 'foo/bar', nextVersion: 'next' },
      });
      writeJson(path.join(tmpDir, 'package.json'), {
        name: 'bar',
      });

      const result = fromPath(tmpDir);
      expect(result.nextVersion).toEqual('next');
      expect(result.repo).toEqual('foo/bar');
    });

    it("reads the configuration from 'package.json'", function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        changelog: { repo: 'foo/bar', nextVersion: 'next' },
      });

      const result = fromPath(tmpDir);
      expect(result.nextVersion).toEqual('next');
      expect(result.repo).toEqual('foo/bar');
    });

    it("prefers 'package.json' over 'lerna.json'", function () {
      writeJson(path.join(tmpDir, 'lerna.json'), {
        changelog: { repo: 'foo/lerna', nextVersion: 'lerna' },
      });

      writeJson(path.join(tmpDir, 'package.json'), {
        changelog: { repo: 'foo/package', nextVersion: 'package' },
      });

      const result = fromPath(tmpDir);
      expect(result.nextVersion).toEqual('package');
      expect(result.repo).toEqual('foo/package');
    });

    it("throws ConfigurationError if neither 'package.json' nor 'lerna.json' exist", function () {
      expect(() => fromPath(tmpDir)).toThrowError(ConfigurationError);
    });

    it('passed in options win over the configured next version', function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        changelog: { repo: 'foo/bar', nextVersion: 'next' },
      });

      const result = fromPath(tmpDir, {
        nextVersion: 'Release',
        ignoreReleases: true,
      });
      expect(result.nextVersion).toEqual('Release');
      expect(result.ignoreReleases).toEqual(true);
    });

    it('fills in the default labels and ignored committers', function () {
      writeJson(path.join(tmpDir, 'package.json'), {
        changelog: { repo: 'foo/bar' },
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
      expect(result.ignoreCommitters).toContain('dependabot[bot]');
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
