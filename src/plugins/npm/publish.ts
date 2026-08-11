import { execa } from 'execa';
import latestVersion from 'latest-version';
import { dirname } from 'path';
import fsExtra from 'fs-extra';
import type { PublishPlugin } from '../../plugin-types.js';

const { existsSync, readJSONSync } = fsExtra;

export interface NpmPublishOptions {
  /** One-time password for npm publish */
  otp?: string;
  /** Publish from a branch other than main/master */
  publishBranch?: string;
  /** npm access level */
  access?: 'public' | 'restricted';
  /** Pass --provenance to npm publish */
  provenance?: boolean;
}

function detectPackageManager(): string {
  if (existsSync('./pnpm-lock.yaml')) {
    return 'pnpm';
  }
  return 'npm';
}

export function npmPublish(options?: NpmPublishOptions) {
  return {
    name: 'npm-publish',

    async shouldPublish(context) {
      // todo: we should deprecate this option, users would just setup a config
      // for their package that doesn't include the npm-publish plugin if they
      // don't want to publish to npm. In the meantime, we should support both.
      const pkg = readJSONSync(context.package.pkgJSONPath);
      if (pkg['release-plan']?.skipNpmPublish) {
        this.info(
          `skipping publish for ${context.package.name}, as config option skipNpmPublish is set in its package.json`,
        );
        return false;
      }

      try {
        const existing = await latestVersion(context.package.name, {
          version: context.package.newVersion,
        });
        if (existing) {
          this.info(
            `${context.package.name} has already been published @ version ${context.package.newVersion}. Skipping publish;`,
          );
          return false;
        }
      } catch (err) {
        if (
          err.name !== 'VersionNotFoundError' &&
          err.name !== 'PackageNotFoundError'
        ) {
          console.error(err.message);
          this.reportFailure(`Problem while checking for existing npm release`);
          return false;
        }
      }

      return true;
    },

    async publish(context) {
      const packageManager = detectPackageManager();
      const args = ['publish'];

      if (options?.otp) {
        args.push(`--otp=${options.otp}`);
      }

      if (options?.publishBranch) {
        args.push(`--publish-branch=${options.publishBranch}`);
      }

      if (options?.access) {
        args.push(`--access=${options.access}`);
      }

      if (context.release.dryRun) {
        args.push('--dry-run');
        this.info(
          `--dryRun active. Adding \`--dry-run\` flag to \`${packageManager} publish${
            options?.otp ? ' --otp=*redacted*' : ''
          }\` for ${context.package.name}, which would publish version ${context.package.newVersion}\n`,
        );
      }

      if (options?.provenance) {
        args.push('--provenance');
      }

      try {
        await execa(
          packageManager,
          [...args, `--tag=${context.package.tagName}`],
          {
            cwd: dirname(context.package.pkgJSONPath),
            stderr: 'inherit',
            stdout: 'inherit',
          },
        );
      } catch (err) {
        this.reportFailure(
          `Failed to ${packageManager} publish ${context.package.name} - Error: ${err.message}`,
        );
      }
    },
  } satisfies PublishPlugin;
}
