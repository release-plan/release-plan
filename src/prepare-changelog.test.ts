import { describe, it, expect, afterEach, beforeEach } from 'vitest';

import { prepare } from './prepare.js';

import { Project } from 'fixturify-project';
import { readFileSync, writeFileSync } from 'fs';

const CHANGELOG = `# Changelog

## v1.2.3

- the previous release
`;

const newChangelogContent = `## v1.3.0

#### :rocket: Enhancement
* \`test-package\`
  * [#1](https://github.com/example/example/pull/1) did a thing
`;

describe('prepare', function () {
  let project;
  let realCwd;

  beforeEach(async () => {
    project = new Project('test-package', '1.2.3', {
      files: {
        'CHANGELOG.md': CHANGELOG,
      },
    });

    await project.write();
    realCwd = process.cwd();
    process.chdir(project.baseDir);
  });

  afterEach(() => {
    process.chdir(realCwd);
  });

  function setConfig(config: Record<string, unknown>) {
    const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
    pkg['release-plan'] = config;
    writeFileSync('./package.json', JSON.stringify(pkg));
  }

  it('updates the changelog by default', async () => {
    await prepare(newChangelogContent);

    expect(readFileSync('./CHANGELOG.md', 'utf8')).toContain('## v1.3.0');
  });

  it('leaves the changelog alone when skipChangelogUpdate is set', async () => {
    setConfig({ skipChangelogUpdate: true });

    await prepare(newChangelogContent);

    expect(readFileSync('./CHANGELOG.md', 'utf8')).toEqual(CHANGELOG);
  });

  it('still bumps versions and saves a description when skipChangelogUpdate is set', async () => {
    setConfig({ skipChangelogUpdate: true });

    await prepare(newChangelogContent);

    expect(JSON.parse(readFileSync('./package.json', 'utf8')).version).toEqual(
      '1.3.0',
    );
    expect(
      JSON.parse(readFileSync('./.release-plan.json', 'utf8')).description,
    ).toContain('did a thing');
  });
});
