# Changelog

Release Plan generates a changelog from the titles of your pull requests. The
generator is a port of
[`github-changelog`](https://github.com/release-plan/github-changelog).

By default the changelog lists the pull requests that were merged after the
latest tag. A pull request needs one of these labels to appear:

- `breaking` (:boom: Breaking Change)
- `enhancement` (:rocket: Enhancement)
- `bug` (:bug: Bug Fix)
- `documentation` (:memo: Documentation)
- `internal` (:house: Internal)

## Configuration

Add a `changelog` key to the `package.json` file of your project:

```json5
{
  // ...
  "changelog": {
    "labels": {
      "feature": "New Feature",
      "bug": "Bug Fix"
    }
  }
}
```

The supported options are:

- `repo`: Your "org/repo" on GitHub
  (automatically inferred from the `package.json` file)

- `github`: the github domain, default: github.com

- `nextVersion`: Title for unreleased commits
  (e.g. `Unreleased`)

- `labels`: GitHub PR labels mapped to changelog section headers

- `wildcardLabel`: A label to identify commits that don't have a GitHub PR label
  which matches a value in `labels`. (e.g. `unlabeled`) By default, this has no
  value. [Read more about this option](#wildcardlabel).

- `ignoreCommitters`: List of committers to ignore (exact or partial match).
  Useful for example to ignore commits from bots.

- `cacheDir`: Path to a GitHub API response cache to avoid throttling
  (e.g. `.changelog`)

### `wildcardLabel`

For some projects, it may be beneficial to list PRs in the changelog that don't
have a matching label defined in the configuration `labels`. Listing these PRs also allows you to review the changelog and identify any PRs that should be re-labeled on GitHub. For example, forgetting to label a breaking change.

```json5
{
  // ...
  "changelog": {
    "wildcardLabel": "unlabeled"
  }
}
```

A default changlog heading of `:present: Additional updates` is set when a value for `wildcardLabel` is in the configuration.

```md
## Unreleased (2018-05-24)

#### 🎁 Additional updates
* [#514](https://github.com/my-org/my-repo/pull/514) Setting to mute video ([@diligent-developer](https://github.com/diligent-developer))
```

You can overwrite the default heading by including the `wildcardLabel` value in the configuration's `labels` object. For example:

```json5
{
  // ...
  "changelog": {
    "labels": {
      "feature": "New Feature",
      "bug": "Bug Fix",
      "unlabeled": "Unlabeled PRs"
    },
    "wildcardLabel": "unlabeled"
  }
}
```
