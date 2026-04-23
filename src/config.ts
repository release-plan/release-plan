import { resolve } from 'path';
import { existsSync } from 'fs';
import { pathToFileURL } from 'url';
import type { ReleasePlanConfig } from './plugin-types.js';
import { githubTags, npmPublish, githubRelease } from './plugins/index.js';

const CONFIG_FILENAME = 'release-plan.config.mjs';

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
