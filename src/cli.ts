#!/usr/bin/env node
import yargs from 'yargs/yargs';
import type { Argv } from 'yargs';

import { readFileSync } from 'fs';
import { parseChangeLogOrExit } from './change-parser.js';
import { publish } from './publish.js';

yargs(process.argv.slice(2))
  .usage(
    `Most of the subcommands in here exist so you can easily test parts of the release process by themselves. To do an actual release, see RELEASE.md.`,
  )
  .scriptName('release')
  .command(
    'prepare',
    `Edits the package.json and changelog files to prepare for release.`,
    (yargs) => fromStdin(yargs),
    async function (opts) {
      const { prepare } = await import('./prepare.js');
      const solution = await prepare(await newChangelogContent(opts));
      const { explain } = await import('./plan.js');
      process.stdout.write(explain(solution));
      process.stdout.write(`\nSuccessfully prepared released\n`);
    },
  )
  .command(
    'publish',
    `Publishes an already-prepared released by tagging, pushing tags, creating GitHub release, and publishing to NPM.`,
    (yargs) =>
      yargs
        .option('skipRepoSafetyCheck', {
          type: 'boolean',
          description:
            'Allows you to run "publish" even if there are uncommitted changes in your repo. Useful only for developing "publish" itself.',
        })
        .option('otp', {
          type: 'string',
          description: 'This is an OTP that will be passed to npm publish',
        })
        .option('dryRun', {
          type: 'boolean',
          description:
            'Run through the release, but log to stdout instead of tagging/pushing/publishing',
        })
        .option('publish-branch', {
          type: 'string',
          description:
            '(pnpm) optionally pass on the --publish-branch if you need to publish from a branch other than main|master',
        })
        .option('tag', {
          type: 'string',
          description: 'pass --tag to npm publish command',
        })
        .option('provenance', {
          type: 'boolean',
          description: 'pass --provenance to the npm publish command',
        })
        .option('access', {
          choices: ['public', 'restricted'],
          description:
            'Tells the registry whether the published package should be public or restricted.',
        })
        .option('github-prerelease', {
          type: 'boolean',
          description: `Allows you to set the GitHub release to a pre-release. This can be useful if you're using release-plan to release beta versions.`,
        }),
    async function (opts) {
      await publish(opts);
    },
  )
  .command(
    'gather-changes',
    `Uses lerna-changelog to build a description of all the PRs in the release.`,
    (yargs) => yargs,
    async function (/* opts */) {
      const { gatherChanges } = await import('./gather-changes.js');
      process.stdout.write(await gatherChanges());
    },
  )
  .command(
    'parse-changes',
    `Parse the summary of changes into a structured format`,
    (yargs) => fromStdin(yargs),
    async function (opts) {
      const { parseChangeLogOrExit } = await import('./change-parser.js');
      console.log(
        JSON.stringify(
          parseChangeLogOrExit(await newChangelogContent(opts)),
          null,
          2,
        ),
      );
    },
  )
  .command(
    'discover-deps',
    `Summarizes how all our published packages relate to each other`,
    (yargs) => yargs,
    async function (/* opts */) {
      const { publishedInterPackageDeps } = await import('./interdep.js');
      console.log(publishedInterPackageDeps());
    },
  )
  .command(
    'explain-plan',
    `Explains which packages need to be released at what versions and why.`,
    (yargs) => fromStdin(yargs),
    async function (opts) {
      const { planVersionBumps, explain } = await import('./plan.js');
      const solution = planVersionBumps(
        parseChangeLogOrExit(await newChangelogContent(opts)),
      );
      console.log(explain(solution));
    },
  )
  .demandCommand()
  .strictCommands()
  .help().argv;

function fromStdin(yargs: Argv) {
  return yargs.option('fromStdin', {
    type: 'boolean',
    description:
      'Read the summary of changes from stdin instead of building them from scratch.',
  });
}

async function newChangelogContent(opts: { fromStdin: boolean | undefined }) {
  let content: string;
  if (opts.fromStdin) {
    content = readFileSync(process.stdin.fd, 'utf8');
  } else {
    const { gatherChanges } = await import('./gather-changes.js');
    content = await gatherChanges();
  }
  return content;
}
