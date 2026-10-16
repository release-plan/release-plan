import pMap from 'p-map';
import { resolve, sep } from 'node:path';

import type { Configuration } from './configuration.js';
import findPullRequestId from './find-pull-request-id.js';
import * as Git from './git.js';
import GithubAPI from './github-api.js';
import type { GitHubContributor } from './github-api.js';
import type { CommitInfo, Release } from './interfaces.js';
import MarkdownRenderer, { UNRELEASED_TAG } from './markdown-renderer.js';

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
      unreleasedName: this.config.nextVersion || 'Unreleased',
    });
  }

  public async createMarkdown(from?: string, to?: string) {
    return this.renderMarkdown(await this.listReleases(from, to));
  }

  public renderMarkdown(releases: Release[]): string {
    return this.renderer.renderMarkdown(releases);
  }

  public async listReleases(
    from: string = Git.lastTag(),
    to: string = 'HEAD',
  ): Promise<Release[]> {
    const commits = await this.getCommitInfos(from, to);
    const releases = this.groupByRelease(commits);
    await this.fillInContributors(releases);
    return releases;
  }

  private async getCommitInfos(
    from: string,
    to: string,
  ): Promise<CommitInfo[]> {
    const commits = Git.listCommits(from, to);
    let commitInfos = this.toCommitInfos(commits);

    await this.downloadIssueData(commitInfos);

    commitInfos = commitInfos.filter(
      (c) =>
        !c.githubIssue?.labels
          .map((l) => l.name)
          .includes(this.config.ignoreLabel),
    );

    this.fillInCategories(commitInfos);
    await this.fillInPackages(commitInfos);

    return commitInfos;
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
      const { sha, refName, summary: message, date } = commit;

      let tagsInCommit;
      if (refName.length > 1) {
        const TAG_PREFIX = 'tag: ';

        tagsInCommit = refName
          .split(', ')
          .filter((ref) => ref.startsWith(TAG_PREFIX))
          .map((ref) => ref.slice(TAG_PREFIX.length));
      }

      const issueNumber = findPullRequestId(message);

      return {
        commitSHA: sha,
        message,
        tags: tagsInCommit,
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

  private groupByRelease(commits: CommitInfo[]): Release[] {
    const releaseMap: { [id: string]: Release } = {};

    const pushCommit = (currentTag: string, commit: CommitInfo) => {
      if (!releaseMap[currentTag]) {
        const date =
          currentTag === UNRELEASED_TAG ? this.getToday() : commit.date;
        releaseMap[currentTag] = { name: currentTag, date, commits: [] };
      }

      const prUserLogin = commit.githubIssue?.user.login;
      if (prUserLogin && !this.ignoreCommitter(prUserLogin)) {
        releaseMap[currentTag].commits.push(commit);
      }
    };

    let currentTags = [UNRELEASED_TAG];
    for (const commit of commits) {
      if (this.config.ignoreReleases) {
        pushCommit(UNRELEASED_TAG, commit);
        continue;
      }

      if (commit.tags && commit.tags.length > 0) {
        currentTags = commit.tags;
      }

      // a commit with several tags is listed under each of them
      for (const currentTag of currentTags) {
        pushCommit(currentTag, commit);
      }
    }

    return Object.keys(releaseMap).map((tag) => releaseMap[tag]);
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

      if (labels.includes(this.config.ignoreLabel)) {
        commit.categories = [this.config.ignoreLabel];
      }
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

  private async fillInContributors(releases: Release[]) {
    for (const release of releases) {
      release.contributors = await this.getCommitters(release.commits);
    }
  }
}

function onlyUnique<T>(value: T, index: number, self: T[]): boolean {
  return self.indexOf(value) === index;
}
