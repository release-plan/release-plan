import { describe, it, expect, afterAll } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultConfig,
  loadConfig,
  loadConfigForPackage,
} from './config.js';
import { join, relative } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Static fixture monorepo with per-package config overrides and a local plugin
const fixtureRoot = join(__dirname, '..', 'fixtures', 'pnpm', 'custom-configs');
const fixturePackages = {
  pkgA: join(fixtureRoot, 'packages', 'pkg-a'),
  pkgB: join(fixtureRoot, 'packages', 'pkg-b'),
  pkgC: join(fixtureRoot, 'packages', 'pkg-c'),
};

// Compiled entry point — what 'release-plan' resolves to via the exports map.
const entryPointDir = join(__dirname, '..', 'dist');

// For loadConfig unit tests that need different config file contents,
// each test gets a unique directory so Node's import() cache never
// returns a stale module.
const tmpRoot = mkdtempSync(join(tmpdir(), 'release-plan-config-test-'));
let dirCounter = 0;
function uniqueDir() {
  const dir = join(tmpRoot, `t${++dirCounter}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeConfig(dir: string, content: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'release-plan.config.mjs'), content);
}

// Clean up temp dirs once after the entire suite
afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('config', function () {
  describe('defaultConfig', function () {
    it('returns three built-in plugins in order', function () {
      const config = defaultConfig();
      expect(config.plugins).toHaveLength(3);
      expect(config.plugins[0].name).toBe('github-tags');
      expect(config.plugins[1].name).toBe('npm-publish');
      expect(config.plugins[2].name).toBe('github-release');
    });
  });

  describe('loadConfig', function () {
    it('returns default config when no config file exists', async function () {
      const dir = uniqueDir();
      const config = await loadConfig(dir);
      expect(config.plugins).toHaveLength(3);
      expect(config.plugins[0].name).toBe('github-tags');
      expect(config.plugins[1].name).toBe('npm-publish');
      expect(config.plugins[2].name).toBe('github-release');
    });

    it('loads config from release-plan.config.mjs', async function () {
      const dir = uniqueDir();
      writeConfig(
        dir,
        `export default { plugins: [{ name: 'custom', publish: async () => {} }] };`,
      );
      const config = await loadConfig(dir);
      expect(config.plugins).toHaveLength(1);
      expect(config.plugins[0].name).toBe('custom');
    });

    it('supports empty plugins array (opt-out)', async function () {
      const dir = uniqueDir();
      writeConfig(dir, `export default { plugins: [] };`);
      const config = await loadConfig(dir);
      expect(config.plugins).toHaveLength(0);
    });

    it('loads built-in plugins with options from entry point', async function () {
      const dir = uniqueDir();
      const mainEntryPath = relative(
        dir,
        join(entryPointDir, 'plugin-types.js'),
      ).replaceAll('\\', '/');
      const pluginsEntryPath = relative(
        dir,
        join(entryPointDir, 'plugins', 'index.js'),
      ).replaceAll('\\', '/');
      writeConfig(
        dir,
        `import { defineConfig } from './${mainEntryPath}';
import { githubTags, npmPublish, githubRelease } from './${pluginsEntryPath}';

export default defineConfig({
  plugins: [
    githubTags(),
    npmPublish({ access: 'public', provenance: true }),
    githubRelease({ prerelease: true }),
  ],
});`,
      );

      const config = await loadConfig(dir);
      expect(config.plugins).toHaveLength(3);
      expect(config.plugins[0].name).toBe('github-tags');
      expect(config.plugins[1].name).toBe('npm-publish');
      expect(config.plugins[2].name).toBe('github-release');
    });

    it('loads config from the fixture monorepo root', async function () {
      const config = await loadConfig(fixtureRoot);
      expect(config.plugins).toHaveLength(2);
      expect(config.plugins[0].name).toBe('fake-registry-publish');
      expect(config.plugins[1].name).toBe('inline-root-plugin');
    });
  });

  describe('loadConfigForPackage', function () {
    it('inherits root config when package has no config (pkg-c)', async function () {
      const config = await loadConfigForPackage(
        fixturePackages.pkgC,
        fixtureRoot,
      );
      expect(config.plugins).toHaveLength(2);
      expect(config.plugins[0].name).toBe('fake-registry-publish');
      expect(config.plugins[1].name).toBe('inline-root-plugin');
    });

    it('uses package-level plugins when present, replacing root (pkg-b)', async function () {
      const config = await loadConfigForPackage(
        fixturePackages.pkgB,
        fixtureRoot,
      );
      expect(config.plugins).toHaveLength(1);
      expect(config.plugins[0].name).toBe('fake-registry-publish');
    });

    it('supports empty plugins array at package level for opt-out (pkg-a)', async function () {
      const config = await loadConfigForPackage(
        fixturePackages.pkgA,
        fixtureRoot,
      );
      expect(config.plugins).toHaveLength(0);
    });

    it('returns root config when pkgDir equals rootDir', async function () {
      const config = await loadConfigForPackage(fixtureRoot, fixtureRoot);
      expect(config.plugins).toHaveLength(2);
      expect(config.plugins[0].name).toBe('fake-registry-publish');
    });

    it('falls back to default config when neither root nor package has config', async function () {
      const rootDir = uniqueDir();
      const pkgDir = join(rootDir, 'packages', 'my-pkg');
      mkdirSync(pkgDir, { recursive: true });

      const config = await loadConfigForPackage(pkgDir, rootDir);
      expect(config.plugins).toHaveLength(3);
      expect(config.plugins[0].name).toBe('github-tags');
    });
  });

  describe('third-party plugins', function () {
    it('loads a third-party plugin from the fixture root config', async function () {
      const config = await loadConfig(fixtureRoot);
      expect(config.plugins[0].name).toBe('fake-registry-publish');
    });

    it('loaded third-party plugin has callable validate and publish', async function () {
      const config = await loadConfig(fixtureRoot);
      const plugin = config.plugins[0];

      expect(typeof plugin.validate).toBe('function');
      expect(typeof plugin.publish).toBe('function');
    });

    it('third-party plugin receives context and api when called', async function () {
      const config = await loadConfig(fixtureRoot);
      const plugin = config.plugins[0] as any;

      const fakeContext = {
        solution: new Map([
          [
            'my-pkg',
            { impact: 'minor', oldVersion: '1.0.0', newVersion: '1.1.0' },
          ],
        ]),
        description: 'test',
        dryRun: true,
      };
      const fakeApi = {
        UserError: class extends Error {},
        reportFailure: () => {},
        info: () => {},
      };

      await plugin.validate(fakeContext, fakeApi);
      await plugin.publish(fakeContext, fakeApi);

      expect(plugin.calls).toHaveLength(2);
      expect(plugin.calls[0].phase).toBe('validate');
      expect(plugin.calls[0].context).toBe(fakeContext);
      expect(plugin.calls[0].api).toBe(fakeApi);
      expect(plugin.calls[1].phase).toBe('publish');
    });

    it('third-party plugin can use api.UserError to abort validate', async function () {
      // pkg-b's config uses fakeRegistryPublish({ failPublish: 'pkg-b-error' })
      // but we need failValidate — use a uniqueDir for this specific scenario
      const dir = uniqueDir();
      const pluginPath = relative(
        dir,
        join(fixtureRoot, 'local-plugin.mjs'),
      ).replaceAll('\\', '/');
      writeConfig(
        dir,
        `import { fakeRegistryPublish } from './${pluginPath}';
export default { plugins: [fakeRegistryPublish({ failValidate: 'missing token' })] };`,
      );

      const config = await loadConfig(dir);
      const plugin = config.plugins[0];

      class TestUserError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'UserError';
        }
      }

      const fakeApi = {
        UserError: TestUserError,
        reportFailure: () => {},
        info: () => {},
      };
      const fakeContext = {
        solution: new Map(),
        description: '',
        dryRun: false,
      };

      await expect(plugin.validate!(fakeContext, fakeApi)).rejects.toThrow(
        'missing token',
      );
    });

    it('third-party plugin can use api.reportFailure for non-fatal errors', async function () {
      // pkg-b's config has fakeRegistryPublish({ failPublish: 'pkg-b-error' })
      const config = await loadConfigForPackage(
        fixturePackages.pkgB,
        fixtureRoot,
      );
      const plugin = config.plugins[0];

      const failures: string[] = [];
      const fakeApi = {
        UserError: class extends Error {},
        reportFailure: (msg: string) => failures.push(msg),
        info: () => {},
      };
      const fakeContext = {
        solution: new Map(),
        description: '',
        dryRun: false,
      };

      // publish should NOT throw, it uses reportFailure instead
      await plugin.publish(fakeContext, fakeApi);
      expect(failures).toEqual(['pkg-b-error']);
    });

    it('can mix third-party and built-in plugins in root config', async function () {
      const config = await loadConfig(fixtureRoot);
      expect(config.plugins).toHaveLength(2);
      expect(config.plugins[0].name).toBe('fake-registry-publish');
      expect(config.plugins[1].name).toBe('inline-root-plugin');
    });

    it('package-level config can use the same local plugin with different options', async function () {
      // pkg-b uses fakeRegistryPublish({ failPublish: 'pkg-b-error' })
      // root uses fakeRegistryPublish() — no failure options
      const rootConfig = await loadConfig(fixtureRoot);
      const pkgBConfig = await loadConfigForPackage(
        fixturePackages.pkgB,
        fixtureRoot,
      );

      const fakeContext = {
        solution: new Map(),
        description: '',
        dryRun: false,
      };

      // Root plugin: no failures
      const rootFailures: string[] = [];
      await rootConfig.plugins[0].publish(fakeContext, {
        UserError: class extends Error {},
        reportFailure: (msg: string) => rootFailures.push(msg),
        info: () => {},
      });
      expect(rootFailures).toEqual([]);

      // pkg-b plugin: reports failure
      const pkgBFailures: string[] = [];
      await pkgBConfig.plugins[0].publish(fakeContext, {
        UserError: class extends Error {},
        reportFailure: (msg: string) => pkgBFailures.push(msg),
        info: () => {},
      });
      expect(pkgBFailures).toEqual(['pkg-b-error']);
    });
  });

});
