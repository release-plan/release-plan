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
  PublishContext,
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

// Mock loadConfig to inject test plugins
const mockPlugins: PublishPlugin[] = [];
vi.mock('./config.js', () => {
  return {
    loadConfig: vi.fn(async () => ({
      plugins: mockPlugins,
    })),
  };
});

// Mock loadSolution to return test data
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

    expect(order).toEqual(['a-validate', 'b-validate', 'a-publish', 'b-publish']);
  });

  it('aborts on UserError from validate phase', async function () {
    const publishCalled: string[] = [];

    mockPlugins.push(
      {
        name: 'failing-plugin',
        async validate(_context, api) {
          throw new api.UserError('Missing credentials');
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
    // Ensure the plugin name is included in the user-facing error output
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

    // Both plugins ran
    expect(publishCalled).toEqual(['bad-plugin', 'good-plugin']);
    // But the process exited with failure due to the thrown error
    expect(exitSpy).toHaveBeenCalledWith(-1);
  });

  it('reports failures from plugins without stopping others', async function () {
    const publishCalled: string[] = [];

    mockPlugins.push(
      {
        name: 'partially-failing',
        async publish(_context, api) {
          publishCalled.push('partially-failing');
          api.reportFailure('One package failed');
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
    // Ensure the failure reporter includes the plugin name in its message
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

    // mockPlugins is already empty

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(exitSpy).not.toHaveBeenCalled();

    stdoutSpy.mockRestore();
  });

  it('passes correct context to plugins', async function () {
    let receivedContext: PublishContext | undefined;

    mockPlugins.push({
      name: 'inspector',
      async publish(context) {
        receivedContext = context;
      },
    });

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(receivedContext).toBeDefined();
    expect(receivedContext!.dryRun).toBe(true);
    expect(receivedContext!.description).toBe('test release');
    expect(receivedContext!.solution.get('test-pkg')).toMatchObject({
      newVersion: '2.0.0',
      impact: 'major',
    });
  });

  it('passes api with UserError, reportFailure, and info to plugins', async function () {
    let receivedApi: PluginAPI | undefined;

    mockPlugins.push({
      name: 'api-inspector',
      async publish(_context, api) {
        receivedApi = api;
      },
    });

    await publish({ skipRepoSafetyCheck: true, dryRun: true });

    expect(receivedApi).toBeDefined();
    expect(typeof receivedApi!.UserError).toBe('function');
    expect(typeof receivedApi!.reportFailure).toBe('function');
    expect(typeof receivedApi!.info).toBe('function');

    // Verify UserError creates proper instances
    const err = new receivedApi!.UserError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UserError');
  });

});
