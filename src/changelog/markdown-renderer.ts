import type {
  GitHubContributor,
  GithubAppInfo,
  GithubUserInfo,
} from './github-api.js';
import type { CommitInfo, Release } from './interfaces.js';

export const UNRELEASED_TAG = '___unreleased___';
const COMMIT_FIX_REGEX = /(fix|close|resolve)(e?s|e?d)? [T#](\d+)/i;

interface CategoryInfo {
  name: string | undefined;
  commits: CommitInfo[];
}

interface Options {
  categories: string[];
  baseIssueUrl: string;
  unreleasedName: string;
}

export default class MarkdownRenderer {
  private options: Options;

  constructor(options: Options) {
    this.options = options;
  }

  public renderMarkdown(releases: Release[]) {
    const output = releases
      .map((release) => this.renderRelease(release))
      .filter(Boolean)
      .join('\n\n\n');
    return output ? `\n${output}` : '';
  }

  public renderRelease(release: Release): string | undefined {
    const categories = this.groupByCategory(release.commits);
    const categoriesWithCommits = categories.filter(
      (category) => category.commits.length > 0,
    );

    if (categoriesWithCommits.length === 0) return '';

    const releaseTitle =
      release.name === UNRELEASED_TAG
        ? this.options.unreleasedName
        : release.name;

    let markdown = `## ${releaseTitle} (${release.date})`;

    for (const category of categoriesWithCommits) {
      markdown += `\n\n#### ${category.name}\n`;

      if (this.hasPackages(category.commits)) {
        markdown += this.renderContributionsByPackage(category.commits);
      } else {
        markdown += this.renderContributionList(category.commits);
      }
    }

    if (release.contributors?.length) {
      markdown += `\n\n${this.renderContributorList(release.contributors)}`;
    }

    return markdown;
  }

  public renderContributionsByPackage(commits: CommitInfo[]) {
    const commitsByPackage: { [id: string]: CommitInfo[] } = {};
    for (const commit of commits) {
      const changedPackages = commit.packages || [];

      const packageName = this.renderPackageNames(changedPackages);

      commitsByPackage[packageName] = commitsByPackage[packageName] || [];
      commitsByPackage[packageName].push(commit);
    }

    const packageNames = Object.keys(commitsByPackage);

    return packageNames
      .map((packageName) => {
        const pkgCommits = commitsByPackage[packageName];
        return `* ${packageName}\n${this.renderContributionList(pkgCommits, '  ')}`;
      })
      .join('\n');
  }

  public renderPackageNames(packageNames: string[]) {
    return packageNames.length > 0
      ? packageNames.map((pkg) => `\`${pkg}\``).join(', ')
      : 'Other';
  }

  public renderContributionList(
    commits: CommitInfo[],
    prefix: string = '',
  ): string {
    return commits
      .map((commit) => this.renderContribution(commit))
      .filter(Boolean)
      .map((rendered) => `${prefix}* ${rendered}`)
      .join('\n');
  }

  public renderContribution(commit: CommitInfo): string | undefined {
    const issue = commit.githubIssue;
    if (issue) {
      let markdown = '';

      if (issue.number && issue.pull_request && issue.pull_request.html_url) {
        const prUrl = issue.pull_request.html_url;
        markdown += `[#${issue.number}](${prUrl}) `;
      }

      if (issue.title && issue.title.match(COMMIT_FIX_REGEX)) {
        issue.title = issue.title.replace(
          COMMIT_FIX_REGEX,
          `Closes [#$3](${this.options.baseIssueUrl}$3)`,
        );
      }

      markdown += `${issue.title} ([@${issue.user.login}](${issue.user.html_url}))`;

      return markdown;
    }
  }

  public renderContributorList(contributors: GitHubContributor[]) {
    const renderedContributors = contributors
      .map((contributor) => `- ${this.renderContributor(contributor)}`)
      .sort();

    return `#### Committers: ${contributors.length}\n${renderedContributors.join('\n')}`;
  }

  public renderContributor(contributor: GitHubContributor): string {
    const userName =
      (contributor as GithubAppInfo).slug ??
      (contributor as GithubUserInfo).login;
    const userNameAndLink = `[@${userName}](${contributor.html_url})`;

    if (contributor.name) {
      const name =
        contributor.name + (!('type' in contributor) ? ' [Bot]' : '');
      return `${name} (${userNameAndLink})`;
    } else {
      return userNameAndLink;
    }
  }

  private hasPackages(commits: CommitInfo[]) {
    return commits.some(
      (commit) => commit.packages !== undefined && commit.packages.length > 0,
    );
  }

  private groupByCategory(allCommits: CommitInfo[]): CategoryInfo[] {
    return this.options.categories.map((name) => {
      const commits = allCommits.filter(
        (commit) => commit.categories && commit.categories.indexOf(name) !== -1,
      );

      return { name, commits };
    });
  }
}
