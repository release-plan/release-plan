import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { npmPublish } from './publish.js';
import type { Solution } from '../../plan.js';
import type { PluginAPI, PublishContext } from '../../plugin-types.js';
import { UserError } from '../../plugin-types.js';
import { getPackages } from '../../interdep.js';
import { execa } from 'execa';

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

describe('npm-publish plugin', function () {
  let solution: Solution;

  beforeEach(() => {
    solution = new Map();
    solution.set('thingy', {
      oldVersion: '3',
      newVersion: '4',
      impact: 'minor',
      constraints: [],
      tagName: 'latest',
      pkgJSONPath: './package.json',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('adds the correct args with no options', async function () {
    const plugin = npmPublish();
    const api = makeApi();
    await plugin.publish(makeContext(solution), api);

    expect(execa).toBeCalledWith('pnpm', ['publish', '--tag=latest'], {
      cwd: '.',
      stderr: 'inherit',
      stdout: 'inherit',
    });
  });

  it('adds access if passed by options', async function () {
    const plugin = npmPublish({ access: 'restricted' });
    const api = makeApi();
    await plugin.publish(makeContext(solution), api);

    expect(execa).toBeCalledWith(
      'pnpm',
      ['publish', '--access=restricted', '--tag=latest'],
      {
        cwd: '.',
        stderr: 'inherit',
        stdout: 'inherit',
      },
    );
  });

  it('adds otp if passed by options', async function () {
    const plugin = npmPublish({ otp: '12345' });
    const api = makeApi();
    await plugin.publish(makeContext(solution), api);

    expect(execa).toBeCalledWith(
      'pnpm',
      ['publish', '--otp=12345', '--tag=latest'],
      {
        cwd: '.',
        stderr: 'inherit',
        stdout: 'inherit',
      },
    );
  });

  it('adds publish-branch if passed by options', async function () {
    const plugin = npmPublish({ publishBranch: 'best-branch' });
    const api = makeApi();
    await plugin.publish(makeContext(solution), api);

    expect(execa).toBeCalledWith(
      'pnpm',
      ['publish', '--publish-branch=best-branch', '--tag=latest'],
      {
        cwd: '.',
        stderr: 'inherit',
        stdout: 'inherit',
      },
    );
  });

  it('adds tag if set in the solution', async function () {
    solution.set('thingy', {
      oldVersion: '3',
      newVersion: '4',
      impact: 'minor',
      constraints: [],
      tagName: 'best-tag',
      pkgJSONPath: './package.json',
    });

    const plugin = npmPublish();
    const api = makeApi();
    await plugin.publish(makeContext(solution), api);

    expect(execa).toBeCalledWith('pnpm', ['publish', '--tag=best-tag'], {
      cwd: '.',
      stderr: 'inherit',
      stdout: 'inherit',
    });
  });

  it('adds dry-run if context.dryRun is true', async function () {
    const plugin = npmPublish();
    const api = makeApi();
    await plugin.publish(makeContext(solution, true), api);

    expect(execa).toBeCalledWith(
      'pnpm',
      ['publish', '--dry-run', '--tag=latest'],
      {
        cwd: '.',
        stderr: 'inherit',
        stdout: 'inherit',
      },
    );
  });

  it('adds provenance if passed by options', async function () {
    const plugin = npmPublish({ provenance: true });
    const api = makeApi();
    await plugin.publish(makeContext(solution), api);

    expect(execa).toBeCalledWith(
      'pnpm',
      ['publish', '--provenance', '--tag=latest'],
      {
        cwd: '.',
        stderr: 'inherit',
        stdout: 'inherit',
      },
    );
  });

  it('warns that a version exists if we are trying to release', async function () {
    const plugin = npmPublish();
    const api = makeApi();
    await plugin.publish(
      makeContext(
        new Map([
          [
            'release-plan',
            {
              oldVersion: '0.8.1',
              newVersion: '0.9.0',
              impact: 'minor',
              pkgJSONPath: './package.json',
            },
          ],
        ]) as Solution,
      ),
      api,
    );

    expect(api.infos[api.infos.length - 1]).toMatchInlineSnapshot(
      `"release-plan has already been published @ version 0.9.0. Skipping publish;"`,
    );
    expect(execa).not.toHaveBeenCalled();
  });

  it('skips publishing if npmSkipPublish is specified in package.json', async function () {
    const packages = getPackages('./fixtures/pnpm/star-package');
    const plugin = npmPublish();
    const api = makeApi();
    await plugin.publish(
      makeContext(
        new Map([
          [
            'do-not-publish',
            {
              oldVersion: '0.8.1',
              newVersion: '0.9.0',
              impact: 'minor',
              constraints: [],
              pkgJSONPath: packages.get('do-not-publish')?.pkgJSONPath,
              tagName: 'latest',
            },
          ],
          [
            'star-package',
            {
              oldVersion: '0.8.1',
              newVersion: '0.9.0',
              impact: 'minor',
              constraints: [],
              pkgJSONPath: packages.get('star-package')?.pkgJSONPath,
              tagName: 'latest',
            },
          ],
        ]) as Solution,
        true,
      ),
      api,
    );

    expect(api.infos[0]).toMatchInlineSnapshot(
      `"skipping publish for do-not-publish, as config option skipNpmPublish is set in its package.json"`,
    );

    expect(execa).toHaveBeenCalledOnce();
    expect(execa).toBeCalledWith(
      'pnpm',
      ['publish', '--dry-run', '--tag=latest'],
      {
        cwd: './fixtures/pnpm/star-package',
        stderr: 'inherit',
        stdout: 'inherit',
      },
    );
  });
});
