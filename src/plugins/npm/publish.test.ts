import { describe, it, expect, vi, afterEach } from 'vitest';
import { npmPublish } from './publish.js';
import type {
  PluginAPI,
  ReleaseContext,
  PluginContext,
  PackageContext,
} from '../../plugin-types.js';
import { ReleaseError } from '../../plugin-types.js';
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

function makeRelease(dryRun = false): ReleaseContext {
  return {
    solution: new Map(),
    description: 'test release',
    dryRun,
  };
}

function makePkg(overrides: Partial<PackageContext> = {}): PackageContext {
  return {
    name: 'thingy',
    oldVersion: '3',
    newVersion: '4',
    tagName: 'latest',
    pkgJSONPath: './package.json',
    ...overrides,
  };
}

function makeContext(
  pkg?: Partial<PackageContext>,
  dryRun = false,
): PluginContext {
  return {
    release: makeRelease(dryRun),
    package: makePkg(pkg),
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
    releaseError(message: string): never {
      throw new ReleaseError(message);
    },
    reportFailure: (msg: string) => failures.push(msg),
    info: (msg: string) => infos.push(msg),
    success: (msg: string) => successes.push(msg),
    failures,
    infos,
    successes,
  };
}

describe('npm-publish plugin', function () {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('adds the correct args with no options', async function () {
    const plugin = npmPublish();
    const api = makeApi();
    await plugin.publish.call(api, makeContext());

    expect(execa).toBeCalledWith('pnpm', ['publish', '--tag=latest'], {
      cwd: '.',
      stderr: 'inherit',
      stdout: 'inherit',
    });
  });

  it('adds access if passed by options', async function () {
    const plugin = npmPublish({ access: 'restricted' });
    const api = makeApi();
    await plugin.publish.call(api, makeContext());

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
    await plugin.publish.call(api, makeContext());

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
    await plugin.publish.call(api, makeContext());

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

  it('adds tag if set in the package context', async function () {
    const plugin = npmPublish();
    const api = makeApi();
    await plugin.publish.call(api, makeContext({ tagName: 'best-tag' }));

    expect(execa).toBeCalledWith('pnpm', ['publish', '--tag=best-tag'], {
      cwd: '.',
      stderr: 'inherit',
      stdout: 'inherit',
    });
  });

  it('adds dry-run if context.release.dryRun is true', async function () {
    const plugin = npmPublish();
    const api = makeApi();
    await plugin.publish.call(api, makeContext({}, true));

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
    await plugin.publish.call(api, makeContext());

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

  it('shouldPublish returns false and logs when version already exists', async function () {
    const plugin = npmPublish();
    const api = makeApi();

    const result = await plugin.shouldPublish.call(
      api,
      makeContext({ name: 'release-plan', newVersion: '0.9.0' }),
    );

    expect(result).toBe(false);
    expect(api.infos[api.infos.length - 1]).toMatchInlineSnapshot(
      `"release-plan has already been published @ version 0.9.0. Skipping publish;"`,
    );
    expect(execa).not.toHaveBeenCalled();
  });

  it('shouldPublish returns false and logs when skipNpmPublish is set', async function () {
    const packages = getPackages('./fixtures/pnpm/star-package');
    const plugin = npmPublish();
    const api = makeApi();

    const result = await plugin.shouldPublish.call(
      api,
      makeContext({
        name: 'do-not-publish',
        pkgJSONPath: packages.get('do-not-publish')?.pkgJSONPath,
      }),
    );

    expect(result).toBe(false);
    expect(api.infos[0]).toMatchInlineSnapshot(
      `"skipping publish for do-not-publish, as config option skipNpmPublish is set in its package.json"`,
    );
  });

  it('publish calls execa once for the single package', async function () {
    const packages = getPackages('./fixtures/pnpm/star-package');
    const plugin = npmPublish();
    const api = makeApi();

    await plugin.publish.call(
      api,
      makeContext(
        {
          name: 'star-package',
          pkgJSONPath: packages.get('star-package')?.pkgJSONPath,
          tagName: 'latest',
        },
        true,
      ),
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
