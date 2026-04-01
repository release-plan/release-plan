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
    (yargs) =>
      fromStdin(yargs).option('singlePackage', {
        type: 'string',
        description:
          'Allows you to run this command in a non monorepo and define the package name',
      }),
    async function (opts) {
      const { prepare } = await import('./prepare.js');
      const solution = await prepare(
        await newChangelogContent(opts),
        opts.singlePackage,
      );
      const { explain } = await import('./plan.js');
      process.stdout.write(explain(solution));
      process.stdout.write(`\nSuccessfully prepared released\n`);
    },
  )
  .command(
    'publish',
    `Publishes an already-prepared release by running publish plugins (tags, package publishing, GitHub release, etc). Configure plugins in release-plan.config.mjs.`,
    (yargs) =>
      yargs
        .option('skipRepoSafetyCheck', {
          type: 'boolean',
          description:
            'Allows you to run "publish" even if there are uncommitted changes in your repo.',
        })
        .option('dryRun', {
          type: 'boolean',
          description:
            'Run through the release, but log to stdout instead of actually publishing.',
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
    (yargs) =>
      fromStdin(yargs).option('singlePackage', {
        type: 'string',
        description:
          'Allows you to run this command in a non monorepo and define the package name',
      }),
    async function (opts) {
      const { planVersionBumps, explain } = await import('./plan.js');
      const solution = planVersionBumps(
        parseChangeLogOrExit(await newChangelogContent(opts)),
        opts.singlePackage,
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
