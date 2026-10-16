import { execa } from 'execa';
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const env = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

/**
 * A real git repo in a temp dir, for tests of history analysis.
 */
export class GitRepo {
  readonly dir = realpathSync(mkdtempSync(join(tmpdir(), 'release-plan-')));

  static async create(): Promise<GitRepo> {
    const repo = new GitRepo();
    await repo.git('init', '--quiet', '--initial-branch=main');
    await repo.git('config', 'commit.gpgsign', 'false');
    await repo.git('config', 'tag.gpgsign', 'false');
    return repo;
  }

  async git(...args: string[]): Promise<string> {
    return (await execa('git', args, { cwd: this.dir, env })).stdout;
  }

  write(files: Record<string, string | object>) {
    for (const [path, content] of Object.entries(files)) {
      const full = join(this.dir, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(
        full,
        typeof content === 'string'
          ? content
          : `${JSON.stringify(content, null, 2)}\n`,
      );
    }
  }

  /** Returns the sha of the new commit. */
  async commit(
    message: string,
    files: Record<string, string | object>,
  ): Promise<string> {
    this.write(files);
    await this.git('add', '-A');
    await this.git('commit', '--quiet', '-m', message);
    return this.git('rev-parse', 'HEAD');
  }
}
