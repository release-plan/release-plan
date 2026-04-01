import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { createHash } from 'crypto';
import type { ReleasePlanConfig } from './plugin-types.js';
import { githubTags, npmPublish, githubRelease } from './plugins/index.js';
import { getPackages } from './interdep.js';

const CONFIG_FILENAME = 'release-plan.config.mjs';

/** Sentinel hash used when no config files exist anywhere (default config). */
const NO_CONFIG_HASH = 'default';

export function defaultConfig(): ReleasePlanConfig {
  return {
    plugins: [githubTags(), npmPublish(), githubRelease()],
  };
}

export async function loadConfig(
  dir: string = process.cwd(),
): Promise<ReleasePlanConfig> {
  const configPath = resolve(dir, CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    return defaultConfig();
  }
  const configUrl = pathToFileURL(configPath).href;
  const config = await import(configUrl);
  return config.default as ReleasePlanConfig;
}

export async function loadConfigForPackage(
  pkgDir: string,
  rootDir: string,
): Promise<ReleasePlanConfig> {
  const rootConfig = await loadConfig(rootDir);
  const packageConfigPath = resolve(pkgDir, CONFIG_FILENAME);

  if (!existsSync(packageConfigPath) || resolve(pkgDir) === resolve(rootDir)) {
    return rootConfig;
  }

  const configUrl = pathToFileURL(packageConfigPath).href;
  const packageMod = await import(configUrl);
  const packageConfig = packageMod.default as Partial<ReleasePlanConfig>;

  // Shallow merge: package-level config overrides root.
  return {
    ...rootConfig,
    ...packageConfig,
  };
}

/**
 * Computes a single deterministic hash over all `release-plan.config.mjs`
 * files in the workspace root plus every package directory discovered
 * by `getPackages()`. Returns a sentinel string when no config files exist.
 *
 * Stored in `.release-plan.json` during `prepare` and compared during
 * `publish` to detect config drift that would require replanning.
 */
export function hashAllConfigs(rootDir: string = process.cwd()): string {
  const absRoot = resolve(rootDir);
  const dirs = new Set<string>();
  dirs.add(absRoot);

  for (const entry of getPackages(rootDir).values()) {
    // pkgJSONPath is relative to cwd, e.g. "./packages/foo/package.json"
    // resolve() without a base uses cwd, matching how pkgJSONPath was built.
    dirs.add(resolve(entry.pkgJSONPath, '..'));
  }

  // Sort for determinism, then collect contents of any config files found
  const sortedDirs = [...dirs].sort();
  const hash = createHash('sha256');
  let found = false;

  for (const dir of sortedDirs) {
    const configPath = resolve(dir, CONFIG_FILENAME);
    if (existsSync(configPath)) {
      found = true;
      // Include the path relative to root in the hash so moving a config
      // file between directories changes the hash even if content is the same.
      const relativePath =
        dir === absRoot
          ? CONFIG_FILENAME
          : `${dir.slice(absRoot.length + 1)}/${CONFIG_FILENAME}`;
      hash.update(relativePath);
      hash.update(readFileSync(configPath, 'utf8'));
    }
  }

  return found ? hash.digest('hex') : NO_CONFIG_HASH;
}
