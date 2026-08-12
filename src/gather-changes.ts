import { execa } from 'execa';
import { resolve } from 'path';
import { dirname } from 'path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export async function gatherChanges() {
  const githubChangelogPath = require.resolve('github-changelog');

  const result = await execa('node', [
    resolve(dirname(githubChangelogPath), '..', 'bin', 'cli.js'),
    '--ignore-releases',
    '--next-version',
    'Release',
  ]);
  return result.stdout;
}
