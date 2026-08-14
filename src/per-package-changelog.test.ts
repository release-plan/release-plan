import { describe, it, expect, afterEach, beforeEach } from 'vitest';

import { prepare } from './prepare.js';

import { Project } from 'fixturify-project';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const changelog = `## Release (2026-08-14)

#### :rocket: Enhancement
* \`face\`
  * [#1](https://example.com/1) Grew a nose ([@someone](https://example.com/someone))

#### :bug: Bug Fix
* \`face\`
  * [#2](https://example.com/2) Unswapped the eyes ([@someone](https://example.com/someone))
* Other
  * [#3](https://example.com/3) Fixed CI ([@someone](https://example.com/someone))

#### Committers: 1
- Someone ([@someone](https://example.com/someone))
`;

describe('per-package changelogs', function () {
  let project: Project;
  let realCwd: string;

  async function setup(rootConfig: Record<string, unknown>) {
    project = new Project('test-package', '1.2.3', {
      files: {
        'pnpm-workspace.yaml': `packages:
  - packages/*
`,
        packages: {
          face: {
            'package.json': JSON.stringify({
              name: 'face',
              version: '0.1.0',
            }),
          },
          hand: {
            'package.json': JSON.stringify({
              name: 'hand',
              version: '0.1.0',
              dependencies: { face: 'workspace:^' },
            }),
          },
        },
      },
    });

    project.pkg.private = true;
    project.pkg['release-plan'] = rootConfig;

    await project.write();
    realCwd = process.cwd();
    process.chdir(project.baseDir);
  }

  afterEach(() => {
    process.chdir(realCwd);
  });

  describe('enabled', function () {
    beforeEach(() => setup({ changelogPerPackage: true }));

    it('writes a changelog into each released package and leaves the root alone', async function () {
      await prepare(changelog);

      expect(existsSync('./CHANGELOG.md')).to.eq(false);

      expect(readFileSync('packages/face/CHANGELOG.md', 'utf8')).to
        .eq(`# Changelog

## v0.2.0 (2026-08-14)

#### :rocket: Enhancement
* [#1](https://example.com/1) Grew a nose ([@someone](https://example.com/someone))

#### :bug: Bug Fix
* [#2](https://example.com/2) Unswapped the eyes ([@someone](https://example.com/someone))
`);
    });

    it('explains dependency-only bumps', async function () {
      await prepare(changelog);

      expect(readFileSync('packages/hand/CHANGELOG.md', 'utf8')).to
        .eq(`# Changelog

## v0.1.1 (2026-08-14)

#### :arrow_up: Dependency Updates
* Has dependency \`workspace:^\` on face
`);
    });

    it('prepends to an existing package changelog', async function () {
      writeFileSync(
        join('packages', 'face', 'CHANGELOG.md'),
        `# Changelog

## v0.1.0 (2026-01-01)

#### :rocket: Enhancement
* [#0](https://example.com/0) The first face ([@someone](https://example.com/someone))
`,
      );

      await prepare(changelog);

      expect(readFileSync('packages/face/CHANGELOG.md', 'utf8')).to
        .eq(`# Changelog

## v0.2.0 (2026-08-14)

#### :rocket: Enhancement
* [#1](https://example.com/1) Grew a nose ([@someone](https://example.com/someone))

#### :bug: Bug Fix
* [#2](https://example.com/2) Unswapped the eyes ([@someone](https://example.com/someone))

## v0.1.0 (2026-01-01)

#### :rocket: Enhancement
* [#0](https://example.com/0) The first face ([@someone](https://example.com/someone))
`);
    });

    it('still describes the whole release in the release plan', async function () {
      await prepare(changelog);

      const { description } = JSON.parse(
        readFileSync('.release-plan.json', 'utf8'),
      );

      expect(description).to.contain('* face 0.2.0 (minor)');
      expect(description).to.contain('* hand 0.1.1 (patch)');
    });
  });

  describe('disabled', function () {
    beforeEach(() => setup({}));

    it('keeps writing the single root changelog', async function () {
      writeFileSync('./CHANGELOG.md', '# Changelog\n');

      await prepare(changelog);

      expect(existsSync('packages/face/CHANGELOG.md')).to.eq(false);
      expect(readFileSync('./CHANGELOG.md', 'utf8')).to.contain(
        '* face 0.2.0 (minor)',
      );
    });
  });
});
