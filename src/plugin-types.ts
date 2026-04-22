export type { Solution } from './plan.js';
export type { Impact } from './change-parser.js';

import type { Solution } from './plan.js';

export interface PublishContext {
  /** The release plan solution: package name -> version bump info */
  solution: Solution;
  /** The changelog description text */
  description: string;
  /** Whether this is a dry run (no real publishing) */
  dryRun: boolean;
}

export interface PluginAPI {
  /**
   * Throw an instance of this for clean user-facing error messages.
   * Non-UserError throws will be displayed with a stack trace.
   */
  UserError: new (message: string) => Error;

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
   * Phase 1: Early precondition check. Runs before any publishing starts.
   *
   * If any plugin's validate() throws, the entire publish is aborted.
   * Throw `api.UserError` for clean messages, or any Error for stack traces.
   */
  validate?(context: PublishContext, api: PluginAPI): Promise<void>;

  /**
   * Phase 2: Decide whether this plugin's publish() should run.
   *
   * Return `true` to proceed, `false` to skip publish() for this plugin.
   * If absent, publish() always runs.
   */
  shouldPublish?(context: PublishContext, api: PluginAPI): Promise<boolean>;

  /**
   * Phase 3: Do the actual publishing work. Only called when shouldPublish()
   * returns `true` (or is absent).
   *
   * Use `api.reportFailure()` for non-fatal errors (other plugins continue).
   * Core wraps this in try/catch so a badly-behaved plugin that throws
   * doesn't prevent other plugins from running.
   */
  publish(context: PublishContext, api: PluginAPI): Promise<void>;
}

export interface ReleasePlanConfig {
  plugins: PublishPlugin[];
}

/**
 * Typed error for clean user-facing messages.
 * When thrown during a plugin's validate() phase, the message is displayed
 * without a stack trace and the publish is aborted.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
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
