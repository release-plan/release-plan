import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  beforeEach,
  type MockInstance,
} from 'vitest';
import { publish } from './publish.js';
import type {
  PublishPlugin,
  PluginAPI,
  PluginContext,
} from './plugin-types.js';

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

// Mock loadConfigForPackage to inject test plugins per package
const mockPlugins: PublishPlugin[] = [];
vi.mock('./config.js', () => {
  return {
    loadConfigForPackage: vi.fn(async () => ({
      plugins: mockPlugins,
    })),
  };
});

// Mock loadSolution to return test data with one package with impact
vi.mock('./plan.js', () => {
  return {
    loadSolution: vi.fn(() => ({
      solution: new Map([
        [
          'test-pkg',
          {
            oldVersion: '1.0.0',
            newVersion: '2.0.0',
            impact: 'major',
            constraints: [],
            tagName: 'latest',
            pkgJSONPath: './package.json',
          },
        ],
      ]),
      description: 'test release',
    })),
  };
});

// Sentinel error thrown by our process.exit mock so execution actually halts
class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

describe('publish orchestrator', function () {
  let exitSpy: MockInstance;

  beforeEach(() => {
    mockPlugins.length = 0;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new ExitError(code ?? -1);
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs plugins in config order', async function () {
    const order: string[] = [];

    mockPlugins.push(
      {
        name: 'first',
        async publish() {
          order.push('first');
        },
      },
      {
        name: 'second',
        async publish() {
          order.push('second');
        },
      },
      {
        name: 'third',
        async publish() {
          order.push('third');
        },
      },
    );

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('runs validate phase before publish phase', async function () {
    const order: string[] = [];

    mockPlugins.push(
      {
        name: 'plugin-a',
        async validate() {
          order.push('a-validate');
        },
        async publish() {
          order.push('a-publish');
        },
      },
      {
        name: 'plugin-b',
        async validate() {
          order.push('b-validate');
        },
        async publish() {
          order.push('b-publish');
        },
      },
    );

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(order).toEqual([
      'a-validate',
      'b-validate',
      'a-publish',
      'b-publish',
    ]);
  });

  it('aborts on ReleaseError from validate phase', async function () {
    const publishCalled: string[] = [];

    mockPlugins.push(
      {
        name: 'failing-plugin',
        async validate() {
          this.releaseError('Missing credentials');
        },
        async publish() {
          publishCalled.push('failing-plugin');
        },
      },
      {
        name: 'other-plugin',
        async publish() {
          publishCalled.push('other-plugin');
        },
      },
    );

    await expect(
      publish({ skipRepoSafetyCheck: true, dryRun: true }),
    ).rejects.toThrow(ExitError);

    expect(exitSpy).toHaveBeenCalledWith(-1);
    expect(publishCalled).toEqual([]);
    const stderrOutput = vi
      .mocked(process.stderr.write)
      .mock.calls.map((c) => c[0])
      .join('');
    expect(stderrOutput).toContain('[failing-plugin]');
    expect(stderrOutput).toContain('Missing credentials');
  });

  it('aborts on generic error from validate phase', async function () {
    const publishCalled: string[] = [];

    mockPlugins.push({
      name: 'broken-plugin',
      async validate() {
        throw new Error('Unexpected error');
      },
      async publish() {
        publishCalled.push('broken-plugin');
      },
    });

    await expect(
      publish({ skipRepoSafetyCheck: true, dryRun: true }),
    ).rejects.toThrow(ExitError);

    expect(exitSpy).toHaveBeenCalledWith(-1);
    expect(publishCalled).toEqual([]);
  });

  it('skips publish when shouldPublish returns false', async function () {
    const publishCalled: string[] = [];

    mockPlugins.push(
      {
        name: 'skip-me',
        async shouldPublish() {
          return false;
        },
        async publish() {
          publishCalled.push('skip-me');
        },
      },
      {
        name: 'run-me',
        async publish() {
          publishCalled.push('run-me');
        },
      },
    );

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(publishCalled).toEqual(['run-me']);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('runs publish when shouldPublish returns true', async function () {
    const publishCalled: string[] = [];

    mockPlugins.push({
      name: 'run-me',
      async shouldPublish() {
        return true;
      },
      async publish() {
        publishCalled.push('run-me');
      },
    });

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(publishCalled).toEqual(['run-me']);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('runs all three hooks in order: validate, shouldPublish, publish', async function () {
    const order: string[] = [];

    mockPlugins.push({
      name: 'full-plugin',
      async validate() {
        order.push('validate');
      },
      async shouldPublish() {
        order.push('shouldPublish');
        return true;
      },
      async publish() {
        order.push('publish');
      },
    });

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(order).toEqual(['validate', 'shouldPublish', 'publish']);
  });

  it('catches thrown errors in publish phase without stopping other plugins', async function () {
    const publishCalled: string[] = [];

    mockPlugins.push(
      {
        name: 'bad-plugin',
        async publish() {
          publishCalled.push('bad-plugin');
          throw new Error('I forgot to use reportFailure');
        },
      },
      {
        name: 'good-plugin',
        async publish() {
          publishCalled.push('good-plugin');
        },
      },
    );

    await expect(
      publish({ skipRepoSafetyCheck: true, dryRun: true }),
    ).rejects.toThrow(ExitError);

    expect(publishCalled).toEqual(['bad-plugin', 'good-plugin']);
    expect(exitSpy).toHaveBeenCalledWith(-1);
  });

  it('reports failures from plugins without stopping others', async function () {
    const publishCalled: string[] = [];

    mockPlugins.push(
      {
        name: 'partially-failing',
        async publish() {
          publishCalled.push('partially-failing');
          this.reportFailure('One package failed');
        },
      },
      {
        name: 'other-plugin',
        async publish() {
          publishCalled.push('other-plugin');
        },
      },
    );

    await expect(
      publish({ skipRepoSafetyCheck: true, dryRun: true }),
    ).rejects.toThrow(ExitError);

    expect(publishCalled).toEqual(['partially-failing', 'other-plugin']);
    expect(exitSpy).toHaveBeenCalledWith(-1);
    const stderrOutput = vi
      .mocked(process.stderr.write)
      .mock.calls.map((c) => c[0])
      .join('');
    expect(stderrOutput).toContain('[partially-failing]');
    expect(stderrOutput).toContain('One package failed');
  });

  it('succeeds when no plugins report failures', async function () {
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    mockPlugins.push({
      name: 'happy-plugin',
      async publish() {
        // no issues
      },
    });

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(exitSpy).not.toHaveBeenCalled();
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('Would have successfully published release');

    stdoutSpy.mockRestore();
  });

  it('does nothing with empty plugins array', async function () {
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(exitSpy).not.toHaveBeenCalled();

    stdoutSpy.mockRestore();
  });

  it('skips packages without impact', async function () {
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const publishCalled: string[] = [];

    // Override solution to have no-impact package
    const { loadSolution } = await import('./plan.js');
    vi.mocked(loadSolution).mockReturnValueOnce({
      solution: new Map([
        ['no-impact-pkg', { impact: undefined, oldVersion: '1.0.0' }],
      ]),
      description: 'test release',
    });

    mockPlugins.push({
      name: 'should-not-run',
      async publish() {
        publishCalled.push('should-not-run');
      },
    });

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(publishCalled).toEqual([]);

    stdoutSpy.mockRestore();
  });

  it('passes correct context to plugins', async function () {
    let receivedContext: PluginContext | undefined;

    mockPlugins.push({
      name: 'inspector',
      async publish(context) {
        receivedContext = context;
      },
    });

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(receivedContext).toBeDefined();
    expect(receivedContext!.release.dryRun).toBe(true);
    expect(receivedContext!.release.description).toBe('test release');
    expect(receivedContext!.package.name).toBe('test-pkg');
    expect(receivedContext!.package.newVersion).toBe('2.0.0');
    expect(receivedContext!.package.oldVersion).toBe('1.0.0');
    expect(receivedContext!.package.tagName).toBe('latest');
  });

  it('passes api via this to plugins', async function () {
    const apiShape: Partial<PluginAPI> = {};

    mockPlugins.push({
      name: 'api-inspector',
      publish: async function (this: PluginAPI) {
        apiShape.releaseError = this.releaseError;
        apiShape.reportFailure = this.reportFailure;
        apiShape.info = this.info;
      },
    });

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(typeof apiShape.releaseError).toBe('function');
    expect(typeof apiShape.reportFailure).toBe('function');
    expect(typeof apiShape.info).toBe('function');
    expect(() => apiShape.releaseError!('test')).toThrow('test');
  });

  it('uses loadConfigForPackage for the per-package phase', async function () {
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    mockPlugins.push({ name: 'p', async publish() {} });

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    const { loadConfigForPackage } = await import('./config.js');
    expect(vi.mocked(loadConfigForPackage)).toHaveBeenCalledOnce();

    stdoutSpy.mockRestore();
  });
});
