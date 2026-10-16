import { execa, execaSync } from 'execa';

export function getRootPath() {
  const cwd = process.cwd();
  return execaSync('git', ['rev-parse', '--show-toplevel'], { cwd }).stdout;
}

export async function changedPaths(sha: string): Promise<string[]> {
  const result = await execa('git', [
    'show',
    '-m',
    '--name-only',
    '--pretty=format:',
    '--first-parent',
    sha,
  ]);
  return result.stdout.split('\n');
}

export function lastTag(): string {
  return execaSync('git', [
    'describe',
    '--abbrev=0',
    '--tags',
    '--first-parent',
  ]).stdout;
}

export interface CommitListItem {
  sha: string;
  refName: string;
  summary: string;
  date: string;
}

export function parseLogMessage(commit: string): CommitListItem | null {
  const parts =
    commit.match(/hash<(.+)> ref<(.*)> message<(.*)> date<(.*)>/) || [];

  if (!parts || parts.length === 0) {
    return null;
  }

  return {
    sha: parts[1],
    refName: parts[2],
    summary: parts[3],
    date: parts[4],
  };
}

export function listCommits(from: string, to: string = ''): CommitListItem[] {
  // the format is parsed by `parseLogMessage`
  return execaSync('git', [
    'log',
    '--oneline',
    '--pretty=hash<%h> ref<%D> message<%s> date<%cd>',
    '--date=short',
    `${from}..${to}`,
  ])
    .stdout.split('\n')
    .filter(Boolean)
    .map(parseLogMessage)
    .filter(Boolean) as CommitListItem[];
}
