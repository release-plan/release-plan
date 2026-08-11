import { execa } from 'execa';
import { dirname, resolve } from 'path';
import { loadSolution } from './plan.js';
import { loadConfigForPackage } from './config.js';
import { ReleaseError } from './plugin-types.js';
import type {
  PluginAPI,
  PublishPlugin,
  ReleaseContext,
  PluginContext,
} from './plugin-types.js';

type PublishOptions = {
  skipRepoSafetyCheck?: boolean;
  dryRun?: boolean;
};

async function hasCleanRepo(): Promise<boolean> {
  const result = await execa('git', ['status', '--porcelain=v1']);
  return result.stdout.length === 0;
}

function info(message: string) {
  process.stdout.write(`\n ℹ️ ${message}`);
}

function success(message: string) {
  process.stdout.write(`\n 🎉 ${message} 🎉\n`);
}

export class IssueReporter {
  hadIssues = false;
  reportFailure(message: string): void {
    this.hadIssues = true;
    process.stderr.write(message);
  }
}

export async function publish(opts: PublishOptions) {
  if (!opts.skipRepoSafetyCheck) {
    if (!(await hasCleanRepo())) {
      process.stderr.write(`You have uncommitted changes.
To publish a release you should start from a clean repo. Run "npx release-plan prepare", then commit the changes, then come back and run "npx release-plan publish.
`);
      process.exit(-1);
    }
  }

  const rootDir = resolve(process.cwd());
  const { solution, description } = loadSolution();

  const release: ReleaseContext = {
    solution,
    description,
    dryRun: opts.dryRun ?? false,
  };

  // IssueReporter stays internal -- plugins only see reportFailure via this
  const reporter = new IssueReporter();

  function apiForPlugin(pluginName: string): PluginAPI {
    return {
      releaseError(message: string): never {
        throw new ReleaseError(message);
      },
      reportFailure: (message: string) =>
        reporter.reportFailure(`[${pluginName}] ${message}`),
      info: (message: string) => info(`[${pluginName}] ${message}`),
      success: (message: string) => success(`[${pluginName}] ${message}`),
    };
  }

  // Build per-package configs and contexts upfront so both loops can use them.
  const packages: Array<{
    context: PluginContext;
    config: { plugins: PublishPlugin[] };
  }> = [];
  for (const [pkgName, entry] of solution) {
    if (!entry.impact) continue;

    const pkgDir = dirname(resolve(entry.pkgJSONPath));
    const config = await loadConfigForPackage(pkgDir, rootDir);

    const context: PluginContext = {
      release,
      package: {
        name: pkgName,
        oldVersion: entry.oldVersion,
        newVersion: entry.newVersion,
        tagName: entry.tagName,
        pkgJSONPath: entry.pkgJSONPath,
      },
    };

    packages.push({ context, config });
  }

  // Phase 1: VALIDATE -- run validate() for every plugin across every package.
  // Nothing is published until all validations pass.
  for (const { context, config } of packages) {
    for (const plugin of config.plugins) {
      if (!plugin.validate) continue;
      try {
        await plugin.validate.call(apiForPlugin(plugin.name), context);
      } catch (err) {
        if (err instanceof ReleaseError) {
          process.stderr.write(`\n[${plugin.name}] ${err.message}\n`);
        } else {
          console.error(err);
        }
        process.exit(-1);
      }
    }
  }

  // Phase 2+3: SHOULD_PUBLISH + PUBLISH -- run per package, per plugin.
  for (const { context, config } of packages) {
    for (const plugin of config.plugins) {
      const api = apiForPlugin(plugin.name);

      let shouldRun = true;
      if (plugin.shouldPublish) {
        shouldRun = await plugin.shouldPublish.call(api, context);
      }

      if (!shouldRun) {
        continue;
      }

      try {
        await plugin.publish.call(api, context);
      } catch (err) {
        reporter.reportFailure(
          `[${plugin.name}] failed unexpectedly: ${err.message}\n`,
        );
      }
    }
  }

  if (reporter.hadIssues) {
    process.stderr.write(`\nSome parts of the release were unsuccessful.\n`);
    process.exit(-1);
  } else {
    if (opts.dryRun) {
      success(`--dryRun active. Would have successfully published release!`);
      return;
    }

    success(`Successfully published release`);
  }
}
