import type { PublishPlugin } from '../../plugin-types.js';
import {
  getRepo,
  createOctokit,
  chooseRepresentativeTag,
  shouldUseSuffixedTags,
  tagFor,
} from './shared.js';

export interface GithubReleaseOptions {
  /** Mark the GitHub release as a pre-release */
  prerelease?: boolean;
}

export function githubRelease(options?: GithubReleaseOptions) {
  return {
    name: 'github-release',

    async validate() {
      if (!process.env.GITHUB_AUTH) {
        this.releaseError(
          'GITHUB_AUTH environment variable is required for creating a GitHub release',
        );
      }
    },

    async shouldPublish(context) {
      // This plugin is repo-scoped: only run for the representative package.
      const useSuffix = shouldUseSuffixedTags(context.release.solution);
      const representativeTag = chooseRepresentativeTag(
        context.release.solution,
        useSuffix,
      );
      const thisTag = tagFor(context.package.name, context.package, useSuffix);

      if (thisTag !== representativeTag) {
        return false;
      }

      // Check whether the release already exists.
      const octokit = createOctokit();
      try {
        const { owner, repo } = await getRepo();
        const response = await octokit.repos.getReleaseByTag({
          owner,
          repo,
          tag: representativeTag,
        });

        if (response.status === 200) {
          this.info(
            `A release with the name '${representativeTag}' already exists`,
          );
          return false;
        }
      } catch (err) {
        if (err.status !== 404) {
          console.error(err.message);
          this.reportFailure(
            `Problem while checking for existing GitHub release`,
          );
          return false;
        }
      }

      return true;
    },

    async publish(context) {
      const useSuffix = shouldUseSuffixedTags(context.release.solution);
      const tagName = chooseRepresentativeTag(
        context.release.solution,
        useSuffix,
      );

      if (context.release.dryRun) {
        this.info(
          `--dryRun active. Skipping creating a Release on GitHub for ${tagName}`,
        );
        return;
      }

      try {
        const { owner, repo } = await getRepo();

        await createOctokit().repos.createRelease({
          owner,
          repo,
          tag_name: tagName,
          target_commitish: process.env.GITHUB_SHA,
          name: tagName,
          body: context.release.description,
          prerelease: options?.prerelease ?? false,
        });
      } catch (err) {
        console.error(err);
        this.reportFailure(`Problem while creating GitHub release`);
      }
    },
  } satisfies PublishPlugin;
}
