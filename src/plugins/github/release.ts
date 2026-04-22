import { Octokit } from '@octokit/rest';
import type { PublishPlugin } from '../../plugin-types.js';
import {
  getRepo,
  createOctokit,
  chooseRepresentativeTag,
  shouldUseSuffixedTags,
} from './shared.js';

export interface GithubReleaseOptions {
  /** Mark the GitHub release as a pre-release */
  prerelease?: boolean;
}

async function doesReleaseExist(
  octokit: Octokit,
  tagName: string,
  reportFailure: (message: string) => void,
): Promise<boolean | undefined> {
  try {
    const { owner, repo } = await getRepo();
    const response = await octokit.repos.getReleaseByTag({
      owner,
      repo,
      tag: tagName,
    });

    return response.status === 200;
  } catch (err) {
    if (err.status === 404) {
      return false;
    }
    console.error(err.message);
    reportFailure(`Problem while checking for existing GitHub release`);
  }
}

export function githubRelease(options?: GithubReleaseOptions): PublishPlugin {
  return {
    name: 'github-release',

    async validate(_context, api) {
      if (!process.env.GITHUB_AUTH) {
        throw new api.UserError(
          'GITHUB_AUTH environment variable is required for creating a GitHub release',
        );
      }
    },

    async publish(context, api) {
      const useSuffix = shouldUseSuffixedTags(context.solution);
      const tagName = chooseRepresentativeTag(context.solution, useSuffix);
      const octokit = createOctokit();

      try {
        const preExisting = await doesReleaseExist(
          octokit,
          tagName,
          api.reportFailure,
        );

        if (preExisting) {
          api.info(`A release with the name '${tagName}' already exists`);
          return;
        }

        if (context.dryRun) {
          api.info(
            `--dryRun active. Skipping creating a Release on GitHub for ${tagName}`,
          );
          return;
        }

        const { owner, repo } = await getRepo();

        await octokit.repos.createRelease({
          owner,
          repo,
          tag_name: tagName,
          target_commitish: process.env.GITHUB_SHA,
          name: tagName,
          body: context.description,
          prerelease: options?.prerelease ?? false,
        });
      } catch (err) {
        console.error(err);
        api.reportFailure(`Problem while creating GitHub release`);
      }
    },
  };
}
