# release-plan

_The most contributor friendly and hands-off release tool there is_.

## Features

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

This allows folks with GH Maintainer access to preview and release to npm without actually needing to have any keys locally on their machine (or access to the npm package, which makes management of the repo separate from the npm package easy and encouraged).

[^gh-by-default]: While GitHub Actions is the default setup via [`create-release-plan-setup`][gh-create]
[^after-initial-setup]: after initial setup, which is already mostly automated.
[^npm-config]: The NPM token can be granular, and the package needs to have its "Publishing access" configured to either "Don't require two-factor authentication" or, "Require two-factor authentication or an automation or granular access token" (recommended). This can be configured under `https://www.npmjs.com/package/{package-name}/access`
[^release-anywhere]: You can release from bed, the mall, the porcelain, anywhere! No need for a computer! (assuming you have a smart phone)

[gh-create]: https://github.com/release-plan/create-release-plan-setup

## Usage & Installation

### Automated

Use [`create-release-plan-setup`][gh-create], see the [README][gh-create] over there for detailed instructions.

If you already have a local `GITHUB_AUTH` token,

```bash
npx create-release-plan-setup@latest 
```

does all the setup for you (aside from repo-configuration ([see here][gh-create]))

<details><summary>how to get a GITHUB_AUTH token</summary>

You can create a [GitHub personal access token here](https://github.com/settings/tokens/new?scopes=repo&description=GITHUB_AUTH+env+variable)

Or, if you use the [`gh` CLI](https://cli.github.com/), you can temporarily expose a token to your local terminal shell via:

```bash
export GITHUB_AUTH=$(gh auth token);
```

</details>

This command will create

```
.github/workflows/
  - plan-release.yml
  - publish.yml
RELEASE.md
```

which is responsible for automating the process that you'd run through manually below.

### Manual

```
npm i --save-dev release-plan
```

To use `release-plan` you need to have a valid `GITHUB_AUTH` environment variable that has the `repo` permission. This allows `release-plan` to check what PRs have been merged since the last release and plan the release accordingly.

For new repositories or those without any tags, `release-plan` also requires an initial tag, we recommend:

```bash
git tag v0.0.0
git push origin v0.0.0
```

1. Run `npx release-plan explain-plan`. If there are unlabeled PRs that need to be released it will complain and show you a list of them. Each PR needs to be labeled with one of:
    - breaking
    - enhancement
    - bug
    - documentation
    - internal

2. Once all the PRs are labeled, `release-plan` will instead show you the release plan, explaining which packages are getting released, at which versions, and why.

3. If you disagree with the plan, you can modify the list of changes before using it to `explain-plan` or `prepare` a release:

    - `npx release-plan gather-changes > /tmp/changelog`
    - edit `/tmp/changelog`
    - `npx release-plan --from-stdin < /tmp/changelog`

    For example, this can be necessary if a PR that's labeled `breaking` touches multiple packages and only one of those packages is actually a breaking change. In that case you can take the other package names out of the description of the PR.

4. Once you're happy with the plan, run `npx release-plan prepare`. This will edit CHANGELOG.md, bump the version numbers in package.json files, and create a file named `.release-plan.json`. Make a PR with these changes.

5. Once the PR is merged, in a clean local repo at the merge commit, run `npx release-plan publish`. If you need an `otp` for your release you can provide that to the `publish` command like this `npx release-plan publish --otp=123456`

### Options (command line)

Some config for `release-plan` applies globally for each run of the program, this means that if you're using `release-plan` to release multiple packages in a monorepo all packages will have the same config. These configuration options are passed via the command-line to the `release-plan publish` command

#### --skipRepoSafetyCheck

Allows you to run "publish" even if there are uncommitted changes in your repo. Useful only for developing "publish" itself

#### --otp <your-one-time-password>

If the publish operation that `release-plan` is going to do requires a one-time-password to complete, you can use this option and `release-plan` will pass this on to `npm` for all operations.

#### --dryRun

Run through the release, but log to stdout instead of tagging/pushing/publishing. This can be useful when you're evaluating what release-plan is going to do when you run `release-plan publish`

#### --publish-branch <branch>

When using `pnpm` there is a check to make sure that you're only publishing from `master` or `main`. Passing --publish-branch to `release-plan` will pass it directly on to `pnpm`. This is not needed when using `npm`
  
#### --provenance

This passes on the `--provenance` flag to `npm publish`. Note this doesn't work with `pnpm` so you would need to set the `NPM_CONFIG_PROVENANCE` environment variable to `true` in your publish script.

#### --access <access-level>

This can be used to tell the registry whether the published package should be public or restricted. If this is omitted it will revert to the default value of `npm` or `pnpm` in your environment

#### --github-prerelease

Allows you to set the GitHub release to a pre-release. This can be useful if you're using release-plan to release beta versions.

### Options (package.json)

This project attempts to have sensible defaults so there is not any need to configure `release-plan` in most cases. There are some cases, like releasing a prerelease version of a package, that might require some configuration depending on the type of prerelease you are doing. For config that is defined per-package (i.e. can be different for each the packages in a monorepo), you can configure that in the `release-plan` section of the package's `package.json` file.

#### semverIncrementAs

When `release-plan` is deciding what part of the semver version to update it considers the **Impact** a PR has on a pakcage. Impact can be either `major`, `minor`, or `patch` and by default they directly map on to the `<major>.<minor>.<patch>` parts of semver versions. For projects that need extra control over how versions are incremented, e.g. you are in a pre-1.0 release and you want a `major` impact to only update the `<minor>` section of semver, then you can set the `semverIncrementAs` setting to remap which semver version a particular **impact** would affect.

```json
{
  "name": "example",
  "version": "0.9.0",
  "release-plan": {
    "semverIncrementAs": {
      "major": "minor"
    }
  }
}
```

#### semverIncrementTag

If you're using the `semverIncrementAs` functionality to do a `premajor` or a `prerelease` version, you might want to tag that prerelease with a Prelease Tag. We use the `semver` library internally so you can read more about [how they do tags in their documentation](https://github.com/npm/node-semver?tab=readme-ov-file#prerelease-tags).

```json
{
  "name": "example",
  "version": "0.9.0",
  "release-plan": {
    "semverIncrementAs": {
      "major": "premajor"
    },
    "semverIncrementTag": "alpha"
  }
}
```

#### publishTag

When you use `release-plan` to publish to npm it will by default publish your package with the `latest` tag on npm. If you are using the `semverIncrementAs` and `semverIncrementTag` configs to do a pre-release you will probably also want to set a different tag on npm to signify that the package is not to be considered `latest` (yet).

```json
{
  "name": "example",
  "version": "0.9.0",
  "release-plan": {
    "semverIncrementAs": {
      "major": "premajor"
    },
    "semverIncrementTag": "alpha",
    "publishTag": "next"
  }
}
```

## Usage in GitHub Enterprise

to use release-plan in GitHub enterprise environment you have to set GITHUB_DOMAIN to your ghe domain

GITHUB_DOMAIN=github.custom.com

if you have a custom api endpoint you need to set it with
GITHUB_API_URL to your ghe api url e.g.

GITHUB_API_URL=https://api.github.custom.com

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
| NPM_TOKEN | only ci     | local      | only ci    |
| GH_TOKEN | only ci      | local      | only ci    |

Note that while it's recommended to use `release-plan` with full automation, `release-plan` can be used locally, as described in the [Manual Installation](#manual) section of this README.

Summary:

|   | release-plan        | release-it | changesets |
| - | ------------------  | ---------- | ---------- |
| number of steps | 5     | 6          | 8          |
| Downsides | n/a      | <ul><li>maintainers need admin access to both GitHub and NPM</li><li>requires a computer</li></ul>      |  <ul><li>requires push access to the submitter's PR, or potentially risk losing steam from the contributor to ask them to create the changeset</li><li>more up-front work required per change/PR</li><li>hard to go back and add a changeset and have it associated with the PR correctly (maybe impossible), so forgetting to add changesets pre-merge can totally ruin the accuracy of changeset's changelog</li><li>requires a computer</li></ul> |

## Origins

This package was originally developed to help release [Embroider](https://github.com/embroider-build/embroider) and was extracted so everyone can use it 🎉
