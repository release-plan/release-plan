# Getting Started

## Automated

Use [`create-release-plan-setup`](https://github.com/release-plan/create-release-plan-setup), see the [README](https://github.com/release-plan/create-release-plan-setup) over there for detailed instructions.

If you already have a local `GITHUB_AUTH` token,

```bash
npx create-release-plan-setup@latest 
```

does all the setup for you (aside from repo-configuration ([see here](https://github.com/release-plan/create-release-plan-setup)))

<details><summary>how to get a <code>GITHUB_AUTH</code> token</summary>

You can create a [GitHub personal access token here](https://github.com/settings/tokens/new?scopes=repo&description=GITHUB_AUTH+env+variable)

Or, if you use the [`gh` CLI](https://cli.github.com/), you can temporarily expose a token to your local terminal shell via:

```bash
export GITHUB_AUTH=$(gh auth token);
```

</details>

This command will create

```txt
.github/workflows/
  - plan-release.yml
  - publish.yml
RELEASE.md
```

which is responsible for automating the process that you'd run through manually below.

## Manual

::: code-group

```bash [npm]
npm i --save-dev release-plan
```

```bash [pnpm]
pnpm add -D release-plan
```

```bash [Yarn]
yarn add -D release-plan
```

:::

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
