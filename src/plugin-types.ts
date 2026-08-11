export type { Solution } from './plan.js';
export type { Impact } from './change-parser.js';

import type { Solution } from './plan.js';

export interface ReleaseContext {
  /** The release plan solution: package name -> version bump info */
  solution: Solution;
  /** The changelog description text */
  description: string;
  /** Whether this is a dry run (no real publishing) */
  dryRun: boolean;
}

export interface PackageContext {
  /** The package name */
  name: string;
  /** The previous version */
  oldVersion: string;
  /** The version being published */
  newVersion: string;
  /** The npm dist-tag to publish under */
  tagName: string;
  /** Path to the package's package.json, relative to cwd */
  pkgJSONPath: string;
}

export interface PluginContext {
  release: ReleaseContext;
  package: PackageContext;
}

export interface PluginAPI {
  /**
   * Abort the entire publish with a clean user-facing message (no stack trace).
   * Use this for expected failure conditions like missing credentials.
   * Any other thrown Error will be displayed with a stack trace.
   */
  releaseError(message: string): never;

  /**
   * Report a non-fatal failure. Other plugins will continue to run.
   * Use this instead of throwing when it's too late to abort the publish.
   */
  reportFailure: (message: string) => void;

  /** Log an informational message to stdout */
  info: (message: string) => void;

  /** Log a success message to stdout */
  success: (message: string) => void;
}

export interface PublishPlugin {
  /** Human-readable plugin name, used in log output */
  name: string;

  /**
   * Phase 1: Precondition check for a single package. Called once per package
   * with impact, before shouldPublish and publish.
   *
   * If any plugin's validate() throws, the entire publish is aborted.
   * Call `this.releaseError('msg')` for clean messages, or throw any Error for stack traces.
   *
   * `this` is bound to the plugin API: use this.releaseError, this.info, etc.
   */
  validate?(this: PluginAPI, context: PluginContext): Promise<void>;

  /**
   * Phase 2: Decide whether this plugin's publish() should run for this package.
   * Called once per package with impact.
   *
   * Return `true` to proceed, `false` to skip publish() for this package.
   * If absent, publish() always runs.
   *
   * `this` is bound to the plugin API: use this.releaseError, this.info, etc.
   */
  shouldPublish?(this: PluginAPI, context: PluginContext): Promise<boolean>;

  /**
   * Phase 3: Do the actual publishing work for a single package.
   * Only called when shouldPublish() returns `true` (or is absent).
   * Called once per package with impact.
   *
   * Use `this.reportFailure()` for non-fatal errors (other plugins continue).
   * Core wraps this in try/catch so a badly-behaved plugin that throws
   * doesn't prevent other plugins from running.
   *
   * `this` is bound to the plugin API: use this.releaseError, this.info, etc.
   */
  publish(this: PluginAPI, context: PluginContext): Promise<void>;
}

export interface ReleasePlanConfig {
  plugins: PublishPlugin[];
}

/**
 * Typed error for clean user-facing messages.
 * When thrown during a plugin's validate() phase, the message is displayed
 * without a stack trace and the publish is aborted.
 */
export class ReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseError';
  }
}

/**
 * Helper for creating a typed release-plan config.
 * Use this in your `release-plan.config.mjs`:
 *
 * ```js
 * import { defineConfig } from 'release-plan';
 * import { githubTags, npmPublish, githubRelease } from 'release-plan/plugins';
 *
 * export default defineConfig({
 *   plugins: [
 *     githubTags(),
 *     npmPublish({ access: 'public' }),
 *     githubRelease({ prerelease: true }),
 *   ],
 * });
 * ```
 */
export function defineConfig(config: ReleasePlanConfig): ReleasePlanConfig {
  return config;
}
