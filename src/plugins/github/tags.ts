import { Octokit } from '@octokit/rest';
import { dirname } from 'path';
import type { PublishPlugin } from '../../plugin-types.js';
import {
  getRepo,
  createOctokit,
  getSha,
  tagFor,
  shouldUseSuffixedTags,
} from './shared.js';

async function doesTagExist(
  octokit: Octokit,
  tag: string,
  reportFailure: (message: string) => void,
): Promise<boolean | undefined> {
  try {
    const { owner, repo } = await getRepo();
    const response = await octokit.git.getRef({
      owner,
      repo,
      ref: `tags/${tag}`,
    });

    return response.status === 200;
  } catch (err) {
    if (err.status === 404) {
      return false;
    }
    console.error(err.message);
    reportFailure(`Problem while checking for existing GitHub tag`);
  }
}

export function githubTags(): PublishPlugin {
  return {
    name: 'github-tags',

    async prepare(_context, api) {
      if (!process.env.GITHUB_AUTH) {
        throw new api.UserError(
          'GITHUB_AUTH environment variable is required for creating tags',
        );
      }
      // Validate that repo URL is parseable
      await getRepo();
    },

    async publish(context, api) {
      const octokit = createOctokit();

      for (const [pkgName, entry] of context.solution) {
        if (!entry.impact) {
          continue;
        }
        try {
          const useSuffix = shouldUseSuffixedTags(context.solution);
          const tag = tagFor(pkgName, entry, useSuffix);
          const cwd = dirname(entry.pkgJSONPath);
          const sha = await getSha(cwd);

          const preExisting = await doesTagExist(
            octokit,
            tag,
            api.reportFailure,
          );

          if (preExisting) {
            api.info(
              `The tag, ${tag}, has already been pushed up for ${pkgName}`,
            );
            // intentional early return since we make a tag for the whole repo, not per-package
            return;
          }

          if (context.dryRun) {
            console.log('logging to infos');
            api.info(`--dryRun active. Skipping \`git tag ${tag}\``);
            continue;
          }

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
          api.reportFailure(`Failed to create tag for ${pkgName}`);
        }
      }
    },
  };
}
