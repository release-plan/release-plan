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

async function doesVersionExist(
  pkgName: string,
  version: string,
  reportFailure: (message: string) => void,
): Promise<boolean | undefined> {
  try {
    const latest = await latestVersion(pkgName, { version });
    return Boolean(latest);
  } catch (err) {
    if (
      err.name === 'VersionNotFoundError' ||
      err.name === 'PackageNotFoundError'
    ) {
      return false;
    }

    console.error(err.message);
    reportFailure(`Problem while checking for existing npm release`);
  }
}

function detectPackageManager(): string {
  if (existsSync('./pnpm-lock.yaml')) {
    return 'pnpm';
  }
  return 'npm';
}

export function npmPublish(options?: NpmPublishOptions): PublishPlugin {
  return {
    name: 'npm-publish',

    async publish(context, api) {
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

      if (context.dryRun) {
        args.push('--dry-run');
      }

      if (options?.provenance) {
        args.push('--provenance');
      }

      for (const [pkgName, entry] of context.solution) {
        if (!entry.impact) {
          continue;
        }

        const pkg = readJSONSync(entry.pkgJSONPath);
        if (pkg['release-plan']?.skipNpmPublish) {
          api.info(
            `skipping publish for ${pkgName}, as config option skipNpmPublish is set in its package.json`,
          );
          continue;
        }

        const preExisting = await doesVersionExist(
          pkgName,
          entry.newVersion,
          api.reportFailure,
        );

        if (preExisting) {
          api.info(
            `${pkgName} has already been published @ version ${entry.newVersion}. Skipping publish;`,
          );
          continue;
        }

        if (context.dryRun) {
          api.info(
            `--dryRun active. Adding \`--dry-run\` flag to \`${packageManager} publish${
              options?.otp ? ' --otp=*redacted*' : ''
            }\` for ${pkgName}, which would publish version ${entry.newVersion}\n`,
          );
        }

        try {
          await execa(packageManager, [...args, `--tag=${entry.tagName}`], {
            cwd: dirname(entry.pkgJSONPath),
            stderr: 'inherit',
            stdout: 'inherit',
          });
        } catch (err) {
          api.reportFailure(
            `Failed to ${packageManager} publish ${pkgName} - Error: ${err.message}`,
          );
        }
      }
    },
  };
}
