import { describe, it, expect, afterEach } from 'vitest';
import { getPackages } from './interdep.js';

import { Project } from 'fixturify-project';

describe('interdep', function () {
  describe('release-plan.overrides.private', function () {
    let realCwd: string;

    afterEach(() => {
      if (realCwd) {
        process.chdir(realCwd);
      }
    });

    async function loadWorkspace(faceConfig?: Record<string, unknown>) {
      const project = new Project('test-package', '1.2.3', {
        files: {
          'pnpm-workspace.yaml': `packages:\n  - packages/*\n`,
          packages: {
            face: {
              'package.json': JSON.stringify({
                name: 'face',
                version: '0.1.0',
                ...(faceConfig ? { 'release-plan': faceConfig } : {}),
              }),
            },
          },
        },
      });

      await project.write();
      realCwd = process.cwd();
      process.chdir(project.baseDir);

      return getPackages('./');
    }

    it('loads a non-private package by default', async function () {
      const packages = await loadWorkspace();

      expect([...packages.keys()].sort()).toEqual(['face', 'test-package']);
    });

    it('skips a package configured with overrides.private', async function () {
      const packages = await loadWorkspace({ overrides: { private: true } });

      expect([...packages.keys()]).toEqual(['test-package']);
      expect(packages.has('face')).toBe(false);
    });

    it('still loads the package when overrides.private is false', async function () {
      const packages = await loadWorkspace({ overrides: { private: false } });

      expect([...packages.keys()].sort()).toEqual(['face', 'test-package']);
    });
  });

  describe('getPackages', function () {
    it('can load a simple pnpm package', function () {
      const answer = getPackages('./');

      expect(Array(...answer.keys())).toMatchInlineSnapshot(`
        [
          "release-plan",
        ]
      `);

      expect(answer.get('release-plan')).toMatchInlineSnapshot(
        {
          pkg: expect.any(Object),
          version: expect.any(String),
        },
        `
        {
          "isDependencyOf": Map {},
          "isPeerDependencyOf": Map {},
          "pkg": Any<Object>,
          "pkgJSONPath": "./package.json",
          "version": Any<String>,
        }
      `,
      );
    });

    it('can load a complex pnpm package', function () {
      const answer = getPackages('./fixtures/pnpm/star-package');

      expect(Array(...answer.keys())).toMatchInlineSnapshot(`
        [
          "do-not-publish",
          "star-package",
        ]
      `);

      expect(answer.get('star-package')).toMatchInlineSnapshot(
        {
          pkg: expect.any(Object),
          version: expect.any(String),
        },
        `
        {
          "isDependencyOf": Map {},
          "isPeerDependencyOf": Map {},
          "pkg": Any<Object>,
          "pkgJSONPath": "./fixtures/pnpm/star-package/package.json",
          "version": Any<String>,
        }
      `,
      );
    });

    describe('pnpm/fixtures/single-package', function () {
      it('can load the workspaces', function () {
        const answer = getPackages('./fixtures/pnpm/single-package');

        expect(Array(...answer.keys())).toMatchInlineSnapshot(`
        [
          "foo-package",
        ]
      `);

        expect(answer.get('foo-package')).toMatchInlineSnapshot(
          {
            pkg: expect.any(Object),
            version: expect.any(String),
          },
          `
          {
            "isDependencyOf": Map {},
            "isPeerDependencyOf": Map {},
            "pkg": Any<Object>,
            "pkgJSONPath": "./fixtures/pnpm/single-package/package.json",
            "version": Any<String>,
          }
        `,
        );
      });
    });

    describe('pnpm/fixtures/multi-lockfile', function () {
      it('can load the workspaces', function () {
        const answer = getPackages('./fixtures/pnpm/multi-lockfile');

        expect(Array(...answer.keys())).toMatchInlineSnapshot(`
          [
            "a",
            "b",
            "c",
          ]
        `);

        expect(answer.get('a')).toMatchInlineSnapshot(
          {
            pkg: expect.any(Object),
            version: expect.any(String),
          },
          `
          {
            "isDependencyOf": Map {},
            "isPeerDependencyOf": Map {},
            "pkg": Any<Object>,
            "pkgJSONPath": "./fixtures/pnpm/multi-lockfile/packages/a/package.json",
            "version": Any<String>,
          }
        `,
        );
        expect(answer.get('b')).toMatchInlineSnapshot(
          {
            pkg: expect.any(Object),
            version: expect.any(String),
          },
          `
          {
            "isDependencyOf": Map {},
            "isPeerDependencyOf": Map {},
            "pkg": Any<Object>,
            "pkgJSONPath": "./fixtures/pnpm/multi-lockfile/packages/b/package.json",
            "version": Any<String>,
          }
        `,
        );
        expect(answer.get('c')).toMatchInlineSnapshot(
          {
            pkg: expect.any(Object),
            version: expect.any(String),
          },
          `
          {
            "isDependencyOf": Map {},
            "isPeerDependencyOf": Map {},
            "pkg": Any<Object>,
            "pkgJSONPath": "./fixtures/pnpm/multi-lockfile/packages/c/package.json",
            "version": Any<String>,
          }
        `,
        );
      });
    });
  });
});
