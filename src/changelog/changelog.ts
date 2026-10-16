import pMap from 'p-map';
import { resolve, sep } from 'node:path';

import type { Configuration } from './configuration.js';
import findPullRequestId from './find-pull-request-id.js';
import * as Git from './git.js';
import GithubAPI from './github-api.js';
import type { GitHubContributor } from './github-api.js';
import type { CommitInfo, Release } from './interfaces.js';
import MarkdownRenderer, { UNRELEASED_TAG } from './markdown-renderer.js';

export interface PackageRange {
  name: string;
  /** absolute */
  path: string;
  /** the last release of this package, undefined when it was never released */
  from: string | undefined;
}

export default class Changelog {
  private readonly config: Configuration;
  private github: GithubAPI;
  private renderer: MarkdownRenderer;

  constructor(config: Configuration) {
    this.config = {
      ...config,
      // longest path first, so a nested package beats the one that contains it
      packages: [...config.packages].sort(
        (a, b) => b.path.length - a.path.length,
      ),
    };
    this.github = new GithubAPI(this.config);
    this.renderer = new MarkdownRenderer({
      categories: Object.keys(this.config.labels).map(
        (key) => this.config.labels[key],
      ),
      baseIssueUrl: this.github.getBaseIssueUrl(this.config.repo),
      unreleasedName: this.config.nextVersion || 'Release',
    });
  }

  /**
   * The commits that change each package since its own last release.
   *
   * `packages` on each commit lists only the packages where the commit
   * is in the range.
   *
   * A commit can land after the last release of one package
   * and before the last release of another.
   * It then counts for the first package only.
   */
  public async listChanges(ranges: PackageRange[]): Promise<CommitInfo[]> {
    const items = new Map<string, Git.CommitListItem>();
    const candidates = new Map<string, Set<string>>();

    for (const range of ranges) {
      for (const item of Git.listCommits(range.from, 'HEAD', [range.path])) {
        items.set(item.sha, item);
        let names = candidates.get(item.sha);
        if (!names) {
          names = new Set();
          candidates.set(item.sha, names);
        }
        names.add(range.name);
      }
    }

    const order = Git.firstParentOrder();
    const sorted = Array.from(items.values()).sort(
      (a, b) => order.get(a.sha)! - order.get(b.sha)!,
    );

    let commits = this.toCommitInfos(sorted);
    await this.fillInPackages(commits);
    for (const commit of commits) {
      const names = candidates.get(commit.commitSHA)!;
      commit.packages = (commit.packages ?? []).filter((name) =>
        names.has(name),
      );
    }
    commits = commits.filter((c) => c.packages!.length > 0);

    await this.downloadIssueData(commits);

    commits = commits.filter((c) => {
      const login = c.githubIssue?.user.login;
      return (
        login &&
        !this.ignoreCommitter(login) &&
        !c
          .githubIssue!.labels.map((l) => l.name)
          .includes(this.config.ignoreLabel)
      );
    });

    this.fillInCategories(commits);
    return commits;
  }

  public async renderMarkdown(commits: CommitInfo[]): Promise<string> {
    const release: Release = {
      name: UNRELEASED_TAG,
      date: this.getToday(),
      commits,
      contributors: await this.getCommitters(commits),
    };
    return this.renderer.renderMarkdown([release]);
  }

  /**
   * A markdown list of the commits, for messages to the user.
   */
  public renderContributionList(commits: CommitInfo[]): string {
    return this.renderer.renderContributionList(commits);
  }

  private async getListOfUniquePackages(sha: string): Promise<string[]> {
    const changedPaths = await Git.changedPaths(sha);

    return changedPaths
      .map((path) => this.packageFromPath(path))
      .filter(Boolean)
      .filter(onlyUnique);
  }

  private packageFromPath(path: string): string {
    const absolutePath = resolve(this.config.rootPath, path);

    const foundPackage = this.config.packages.find((p) => {
      // trailing separator so `foo-2/` does not match package `foo`
      const withSlash = p.path.endsWith(sep) ? p.path : `${p.path}${sep}`;
      return absolutePath.startsWith(withSlash);
    });

    return foundPackage?.name ?? '';
  }

  private async getCommitters(
    commits: CommitInfo[],
  ): Promise<GitHubContributor[]> {
    const committers: { [id: string]: GitHubContributor } = {};

    for (const commit of commits) {
      const issue = commit.githubIssue;
      const user = issue && issue.user;
      const login = user && user.login;

      if (login && !this.ignoreCommitter(login) && !committers[login]) {
        committers[login] = this.sanitizeCommitter(
          await this.github.getUserData(user),
        );
      }
    }

    return Object.keys(committers).map((k) => committers[k]);
  }

  private ignoreCommitter(login: string): boolean {
    return this.config.ignoreCommitters.some(
      (c: string) => c === login || login.indexOf(c) > -1,
    );
  }

  private sanitizeCommitter(contributor: GitHubContributor) {
    if (contributor.name === 'Copilot SWE Agent') {
      contributor.name = 'Copilot';
    }

    return contributor;
  }

  private toCommitInfos(commits: Git.CommitListItem[]): CommitInfo[] {
    return commits.map((commit) => {
      const { sha, summary: message, date } = commit;

      const issueNumber = findPullRequestId(message);

      return {
        commitSHA: sha,
        message,
        issueNumber,
        date,
      } as CommitInfo;
    });
  }

  private async downloadIssueData(commitInfos: CommitInfo[]) {
    await pMap(
      commitInfos,
      async (commitInfo: CommitInfo) => {
        if (commitInfo.issueNumber) {
          commitInfo.githubIssue = await this.github.getIssueData(
            this.config.repo,
            commitInfo.issueNumber,
          );
        }
      },
      { concurrency: 5 },
    );
  }

  protected getToday() {
    const date = new Date().toISOString();
    return date.slice(0, date.indexOf('T'));
  }

  private fillInCategories(commits: CommitInfo[]) {
    for (const commit of commits) {
      if (!commit.githubIssue || !commit.githubIssue.labels) continue;

      const labels = commit.githubIssue.labels.map((label) =>
        label.name.toLowerCase(),
      );

      if (this.config.wildcardLabel) {
        const foundLabel = Object.keys(this.config.labels).some(
          (label) => labels.indexOf(label.toLowerCase()) !== -1,
        );

        if (!foundLabel) {
          labels.push(this.config.wildcardLabel);
        }
      }

      commit.categories = Object.keys(this.config.labels)
        .filter((label) => labels.indexOf(label.toLowerCase()) !== -1)
        .map((label) => this.config.labels[label]);
    }
  }

  private async fillInPackages(commits: CommitInfo[]) {
    await pMap(
      commits,
      async (commit: CommitInfo) => {
        commit.packages = await this.getListOfUniquePackages(commit.commitSHA);
      },
      { concurrency: 5 },
    );
  }
}

function onlyUnique<T>(value: T, index: number, self: T[]): boolean {
  return self.indexOf(value) === index;
}
