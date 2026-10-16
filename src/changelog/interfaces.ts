import type { GitHubIssueResponse, GitHubContributor } from './github-api.js';

export interface CommitInfo {
  commitSHA: string;
  message: string;
  tags?: string[];
  date: string;
  issueNumber: string | null;
  githubIssue?: GitHubIssueResponse;
  categories?: string[];
  packages?: string[];
}

export interface Release {
  name: string;
  date: string;
  commits: CommitInfo[];
  contributors?: GitHubContributor[];
}
