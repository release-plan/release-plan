# Features

- ✨ No manual steps[^after-initial-setup]
  - release from _anywhere_[^release-anywhere]
- 🤖 Everything is automated via GH Action Workflows[^gh-by-default]
- 🔐 No need to give maintainers access to npm[^npm-config]
- 📦 PNPM and monorepo support _by default_
  - also supports non-pnpm repos
- 🚀 Release preview PR
  - release via merge of the release preview PR
- 📝 Automatic changelog
  - changelog entries editable by editing PR titles

## Comparison

Note that we take the stance of reducing friction for new contributors (regardless of how new to GitHub they are), we want to optimize for the contribution, and assume that maintainers can handle a little bit of process -- and with this stance, changesets is the _most work_ out of this comparison.

Additionally, this comparison assumes the recommended configuration for each release tool.

| release-plan        | release-it (requires computer) | changesets (requires computer) |
| ------------------  | ------------------------------ | ------------------------------ |
| add a label to a PR | same                           | have the repo cloned
| merge the PR        | same                           | add the remote of the PR-submitter to your local git
|                     |                                | checkout the branch
|                     |                                | run `pnpm changeset`
|                     |                                | write something about the change
|                     |                                | push it back up to the PR-submitter's branch
| ensure the PR title is what you want in the changelog | same |
|                     | have the repo cloned |
|                     | update / sync repo locally |
|                     | run `npx release -it`     |
| automation creates a preview PR |  | same
| merging that preview PR does the actual release | | same

_Needed_ Access:

|   | release-plan        | release-it | changesets |
| - | ------------------  | ---------- | ---------- |
| `NPM_TOKEN` | only ci     | local      | only ci    |
| `GH_TOKEN` | only ci      | local      | only ci    |

Note that while it's recommended to use `release-plan` with full automation, `release-plan` can be used locally, as described in the [Manual Installation](#manual) section of this README.

Summary:

|   | release-plan        | release-it | changesets |
| - | ------------------  | ---------- | ---------- |
| number of steps | 5     | 6          | 8          |
| Downsides | n/a      | <ul><li>maintainers need admin access to both GitHub and NPM</li><li>requires a computer</li></ul>      |  <ul><li>requires push access to the submitter's PR, or potentially risk losing steam from the contributor to ask them to create the changeset</li><li>more up-front work required per change/PR</li><li>hard to go back and add a changeset and have it associated with the PR correctly (maybe impossible), so forgetting to add changesets pre-merge can totally ruin the accuracy of changeset's changelog</li><li>requires a computer</li></ul> |

[^gh-by-default]: While GitHub Actions is the default setup via [`create-release-plan-setup`](https://github.com/release-plan/create-release-plan-setup)
[^after-initial-setup]: after initial setup, which is already mostly automated.
[^npm-config]: The NPM token can be granular, and the package needs to have its "Publishing access" configured to either "Don't require two-factor authentication" or, "Require two-factor authentication or an automation or granular access token" (recommended). This can be configured under `https://www.npmjs.com/package/{package-name}/access`
[^release-anywhere]: You can release from bed, the mall, the porcelain,
    anywhere! No need for a computer! (assuming you have a smart phone)
