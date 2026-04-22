import { execa } from 'execa';
import { loadSolution } from './plan.js';
import { loadConfig } from './config.js';
import { UserError } from './plugin-types.js';
import type { PluginAPI, PublishContext } from './plugin-types.js';

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

  const { solution, description } = loadSolution();

  const config = await loadConfig();

  const context: PublishContext = {
    solution,
    description,
    dryRun: opts.dryRun ?? false,
  };

  // IssueReporter stays internal -- plugins only see reportFailure function
  const reporter = new IssueReporter();

  function apiForPlugin(pluginName: string): PluginAPI {
    return {
      UserError,
      reportFailure: (message: string) =>
        reporter.reportFailure(`[${pluginName}] ${message}`),
      info: (message: string) => info(`[${pluginName}] ${message}`),
      success: (message: string) => success(`[${pluginName}] ${message}`),
    };
  }

  // Phase 1: PREPARE -- run all plugins' prepare() checks.
  // If any plugin throws, the entire publish is aborted.
  for (const plugin of config.plugins) {
    if (plugin.prepare) {
      try {
        await plugin.prepare(context, apiForPlugin(plugin.name));
      } catch (err) {
        if (err instanceof UserError) {
          process.stderr.write(`\n[${plugin.name}] ${err.message}\n`);
        } else {
          console.error(err);
        }
        process.exit(-1);
      }
    }
  }

  // Phase 2: PUBLISH -- run all plugins' publish() in order.
  for (const plugin of config.plugins) {
    try {
      await plugin.publish(context, apiForPlugin(plugin.name));
    } catch (err) {
      reporter.reportFailure(
        `[${plugin.name}] failed unexpectedly: ${err.message}\n`,
      );
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
