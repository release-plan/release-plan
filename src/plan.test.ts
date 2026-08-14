import { describe, it, expect, afterEach, beforeEach } from 'vitest';

import { explain, planVersionBumps, Solution } from './plan.js';
import { publishedInterPackageDeps } from './interdep.js';

import { Project } from 'fixturify-project';
import { writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('plan', function () {
  let project;
  let realCwd;

  beforeEach(async () => {
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
        },
      },
    });

    project.addDependency('face', 'workspace:*');

    await project.write();
    realCwd = process.cwd();
    process.chdir(project.baseDir);
  });

  afterEach(() => {
    process.chdir(realCwd);
  });

  it('can make a basic plan', function () {
    const solution = planVersionBumps({
      sections: [
        {
          packages: ['test-package'],
          groups: [],
          impact: 'minor',
          heading: 'enhancement',
        },
      ],
    });

    expect(solution).to.deep.equal(
      new Map([
        [
          'face',
          {
            impact: undefined,
            oldVersion: '0.1.0',
          },
        ],
        [
          'test-package',
          {
            constraints: [
              {
                impact: 'minor',
                reason: 'Appears in changelog section enhancement',
                kind: 'changelog',
              },
            ],
            impact: 'minor',
            newVersion: '1.3.0',
            oldVersion: '1.2.3',
            pkgJSONPath: './package.json',
            tagName: 'latest',
          },
        ],
      ]),
    );
  });

  it('propagates dependencies correctly', () => {
    const solution = planVersionBumps({
      sections: [
        {
          packages: ['face'],
          groups: [],
          impact: 'minor',
          heading: 'enhancement',
        },
      ],
    });

    expect(solution).to.deep.equal(
      new Map([
        [
          'face',
          {
            constraints: [
              {
                impact: 'minor',
                reason: 'Appears in changelog section enhancement',
                kind: 'changelog',
              },
            ],
            impact: 'minor',
            newVersion: '0.2.0',
            oldVersion: '0.1.0',
            pkgJSONPath: './packages/face/package.json',
            tagName: 'latest',
          },
        ],
        [
          'test-package',
          {
            constraints: [
              {
                impact: 'patch',
                reason: 'Has dependency `workspace:*` on face',
                kind: 'dependency',
              },
            ],
            impact: 'patch',
            newVersion: '1.2.4',
            oldVersion: '1.2.3',
            pkgJSONPath: './package.json',
            tagName: 'latest',
          },
        ],
      ]),
    );
  });

  it('ignores unknown packages', () => {
    const solution = planVersionBumps({
      sections: [
        {
          packages: ['face-not-exist'],
          groups: [],
          impact: 'major',
          heading: 'enhancement',
        },
      ],
    });

    expect(solution).to.deep.equal(
      new Map([
        [
          'face',
          {
            impact: undefined,
            oldVersion: '0.1.0',
          },
        ],
        [
          'test-package',
          {
            impact: undefined,
            oldVersion: '1.2.3',
          },
        ],
      ]),
    );
  });

  it('reads package.json config correctly for semver config', async () => {
    project.pkg['release-plan'] = {
      semverIncrementAs: {
        minor: 'major',
      },
    };

    // There is a bug in fixturify project where you can't call await project.write()
    // more than once when you have depedencies in the project so we need to do this
    // manually
    await writeFile(
      join(project.baseDir, 'package.json'),
      JSON.stringify(project.pkg),
    );

    const solution = planVersionBumps({
      sections: [
        {
          packages: ['test-package'],
          groups: [],
          impact: 'minor',
          heading: 'enhancement',
        },
      ],
    });

    expect(solution).to.deep.equal(
      new Map([
        [
          'face',
          {
            impact: undefined,
            oldVersion: '0.1.0',
          },
        ],
        [
          'test-package',
          {
            constraints: [
              {
                impact: 'minor',
                reason: 'Appears in changelog section enhancement',
                kind: 'changelog',
              },
            ],
            impact: 'minor',
            newVersion: '2.0.0',
            oldVersion: '1.2.3',
            pkgJSONPath: './package.json',
            tagName: 'latest',
          },
        ],
      ]),
    );
  });

  it('reads package.json config correctly for tagName config', async () => {
    project.pkg['release-plan'] = {
      publishTag: 'alpha',
    };

    // There is a bug in fixturify project where you can't call await project.write()
    // more than once when you have depedencies in the project so we need to do this
    // manually
    await writeFile(
      join(project.baseDir, 'package.json'),
      JSON.stringify(project.pkg),
    );

    const solution = planVersionBumps({
      sections: [
        {
          packages: ['face'],
          groups: [],
          impact: 'minor',
          heading: 'enhancement',
        },
      ],
    });

    expect(solution).to.deep.equal(
      new Map([
        [
          'face',
          {
            impact: 'minor',
            oldVersion: '0.1.0',
            constraints: [
              {
                impact: 'minor',
                reason: 'Appears in changelog section enhancement',
                kind: 'changelog',
              },
            ],
            newVersion: '0.2.0',
            pkgJSONPath: './packages/face/package.json',
            tagName: 'latest',
          },
        ],
        [
          'test-package',
          {
            constraints: [
              {
                impact: 'patch',
                reason: 'Has dependency `workspace:*` on face',
                kind: 'dependency',
              },
            ],
            impact: 'patch',
            newVersion: '1.2.4',
            oldVersion: '1.2.3',
            pkgJSONPath: './package.json',
            tagName: 'alpha',
          },
        ],
      ]),
    );
  });

  it('allows you to define semver tag', async () => {
    project.pkg['release-plan'] = {
      semverIncrementAs: {
        major: 'premajor',
      },
      semverIncrementTag: 'alpha',
    };

    // There is a bug in fixturify project where you can't call await project.write()
    // more than once when you have depedencies in the project so we need to do this
    // manually
    await writeFile(
      join(project.baseDir, 'package.json'),
      JSON.stringify(project.pkg),
    );

    const solution = planVersionBumps({
      sections: [
        {
          packages: ['test-package'],
          groups: [],
          impact: 'major',
          heading: 'breaking',
        },
      ],
    });

    expect(solution).to.deep.equal(
      new Map([
        [
          'face',
          {
            impact: undefined,
            oldVersion: '0.1.0',
          },
        ],
        [
          'test-package',
          {
            constraints: [
              {
                impact: 'major',
                reason: 'Appears in changelog section breaking',
                kind: 'changelog',
              },
            ],
            impact: 'major',
            newVersion: '2.0.0-alpha.0',
            oldVersion: '1.2.3',
            pkgJSONPath: './package.json',
            tagName: 'latest',
          },
        ],
      ]),
    );
  });

  describe('release-plan.ignore', function () {
    async function writePackageConfig(
      relativeDir: string,
      config: Record<string, unknown>,
    ) {
      const pkgJSONPath = join(relativeDir, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgJSONPath, 'utf8'));
      pkg['release-plan'] = config;
      await writeFile(pkgJSONPath, JSON.stringify(pkg));
    }

    it('scrubs excluded consumers from the dependency graph', async () => {
      const before = publishedInterPackageDeps();
      expect([...before.keys()]).toContain('test-package');
      expect([...before.get('face')!.isDependencyOf.keys()]).toEqual([
        'test-package',
      ]);

      await writePackageConfig('.', { ignore: true });

      const after = publishedInterPackageDeps();
      expect([...after.keys()]).not.toContain('test-package');
      expect([...after.get('face')!.isDependencyOf.keys()]).toEqual([]);
    });

    it('includes a package when ignore is false', async () => {
      await writePackageConfig('packages/face', { ignore: false });

      const solution = planVersionBumps({
        sections: [
          {
            packages: ['test-package'],
            groups: [],
            impact: 'minor',
            heading: 'enhancement',
          },
        ],
      });

      expect(solution).to.deep.equal(
        new Map([
          [
            'face',
            {
              impact: undefined,
              oldVersion: '0.1.0',
            },
          ],
          [
            'test-package',
            {
              constraints: [
                {
                  impact: 'minor',
                  reason: 'Appears in changelog section enhancement',
                  kind: 'changelog',
                },
              ],
              impact: 'minor',
              newVersion: '1.3.0',
              oldVersion: '1.2.3',
              pkgJSONPath: './package.json',
              tagName: 'latest',
            },
          ],
        ]),
      );
    });
  });

  describe('explain', function () {
    let solution: Solution;

    beforeEach(() => {
      solution = new Map();
    });
    it('wont error with an empty solution', function () {
      expect(explain(solution)).toMatchInlineSnapshot(`""`);
    });

    it('outputs a mostly empty solution when no impact is defined', function () {
      solution.set('thingy', { oldVersion: '0.0.1' });
      solution.set('other-thingy', { impact: undefined, oldVersion: '0.0.1' });

      expect(explain(solution)).toMatchInlineSnapshot(`
        "Unreleased

        ## thingy
          thingy unchanged
        ## other-thingy
          other-thingy unchanged
        "
      `);
    });

    it('correctly bumps packages when there is an impact', function () {
      solution.set('thingy', {
        impact: 'major',
        oldVersion: '0.0.1',
        newVersion: '1.0.0',
        constraints: [
          { impact: 'major', reason: 'this is the reason it is in the place' },
          {
            impact: 'minor',
            reason:
              'this reason wont be mentioned because it has a lower impact',
          },
        ],
        pkgJSONPath: './package.json ',
      });

      solution.set('other-thingy', {
        impact: 'minor',
        oldVersion: '0.0.1',
        newVersion: '0.1.0',
        constraints: [
          { impact: 'minor', reason: 'this is the reason it is in the place' },
          {
            impact: 'patch',
            reason:
              'this reason wont be mentioned because it has a lower impact',
          },
        ],
        pkgJSONPath: './packages/other-thingy/package.json ',
      });

      solution.set('last-thingy', {
        impact: 'patch',
        oldVersion: '0.0.1',
        newVersion: '0.1.0',
        constraints: [
          { impact: 'patch', reason: 'this is the reason it is in the place' },
          {
            impact: 'patch',
            reason:
              'this reason will also be mentioned because it has the same impact',
          },
        ],
        pkgJSONPath: './packages/other-thingy/package.json ',
      });

      expect(explain(solution)).toMatchInlineSnapshot(`
        "Major

          thingy from 0.0.1 to 1.0.0
           - this is the reason it is in the place

        Minor

          other-thingy from 0.0.1 to 0.1.0
           - this is the reason it is in the place

        Patch

          last-thingy from 0.0.1 to 0.1.0
           - this is the reason it is in the place
           - this reason will also be mentioned because it has the same impact
        "
      `);
    });
  });
});
