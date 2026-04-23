import { dirname } from 'path';
import type { PublishPlugin } from '../../plugin-types.js';
import {
  getRepo,
  createOctokit,
  getSha,
  tagFor,
  shouldUseSuffixedTags,
} from './shared.js';

export function githubTags() {
  return {
    name: 'github-tags',

    async validate() {
      if (!process.env.GITHUB_AUTH) {
        this.releaseError(
          'GITHUB_AUTH environment variable is required for creating tags',
        );
      }
      // Validate that repo URL is parseable
      await getRepo();
    },

    async shouldPublish(context) {
      const useSuffix = shouldUseSuffixedTags(context.release.solution);
      const tag = tagFor(context.package.name, context.package, useSuffix);
      const octokit = createOctokit();

      try {
        const { owner, repo } = await getRepo();
        const response = await octokit.git.getRef({
          owner,
          repo,
          ref: `tags/${tag}`,
        });

        if (response.status === 200) {
          this.info(
            `The tag, ${tag}, has already been pushed up for ${context.package.name}`,
          );
          return false;
        }
      } catch (err) {
        if (err.status !== 404) {
          console.error(err.message);
          this.reportFailure(`Problem while checking for existing GitHub tag`);
          return false;
        }
      }

      return true;
    },

    async publish(context) {
      const useSuffix = shouldUseSuffixedTags(context.release.solution);
      const tag = tagFor(context.package.name, context.package, useSuffix);
      const cwd = dirname(context.package.pkgJSONPath);

      try {
        const sha = await getSha(cwd);

        if (context.release.dryRun) {
          this.info(`--dryRun active. Skipping \`git tag ${tag}\``);
          return;
        }

        const octokit = createOctokit();

        const { owner, repo } = await getRepo();
        await octokit.git.createRef({
          owner,
          repo,
          sha,
          ref: `refs/tags/${tag}`,
          type: 'commit',
        });
      } catch (err) {
        console.error(err);
        this.reportFailure(`Failed to create tag for ${context.package.name}`);
      }
    },
  } satisfies PublishPlugin;
}
