# Config

This project attemps to have sensible defaults so there is not any need to configure `release-plan` in most cases. There are some cases, like releasing a prerelease version of a package, that might require some configuration depending on the type of prerelease you are doing. You can configure that in the `release-plan` section of your `package.json`, or if you're in a monorepo in the `release-plan` section of the package that you want set the config for. This way you can have multiple packages with different configurations if you need to.

## `semverIncrementAs`

When `release-plan` is deciding what part of the semver version to update it considers the **Impact** a PR has on a pakcage. Impact can be either `major`, `minor`, or `patch` and by default they directly map on to the `<major>.<minor>.<patch>` parts of semver versions. For projects that need extra control over how versions are incremented, e.g. you are in a pre-1.0 release and you want a `major` impact to only update the `<minor>` section of semver, then you can set the `semverIncrementAs` setting to remap which semver version a particular **impact** would affect.

::: code-group

```json [package.json]
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

:::

## `semverIncrementTag`

If you're using the `semverIncrementAs` functionality to do a `premajor` or a
`prerelease` version, you might want to tag that prerelease with a Prelease Tag.
We use the `semver` library internally so you can read more about [how they do
tags in their
documentation](https://github.com/npm/node-semver?tab=readme-ov-file#prerelease-tags).

::: code-group

```json [package.json]
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

:::

## `publishTag`

When you use `release-plan` to publish to npm it will by default publish your package with the `latest` tag on npm. If you are using the `semverIncrementAs` and `semverIncrementTag` configs to do a pre-release you will probably also want to set a different tag on npm to signify that the package is not to be considered `latest` (yet).

::: code-group

```json [package.json]
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

:::

## `changelogPerPackage`

By default `release-plan` maintains a single `CHANGELOG.md` at the root of the repo, listing every released package together. Set `changelogPerPackage` to `true` and it instead writes a `CHANGELOG.md` next to each released package's `package.json`, containing only that package's changes. The root `CHANGELOG.md` is left untouched from then on.

Unlike the other settings on this page, this one describes the whole repo, so it is only read from the workspace root `package.json`.

::: code-group

```json [package.json]
{
  "name": "my-monorepo",
  "private": true,
  "release-plan": {
    "changelogPerPackage": true
  }
}
```

:::

A package's changelog gets one section per changelog heading, carrying just the pull requests attributed to it:

```md
## v1.3.0 (2026-08-14)

#### :rocket: Enhancement

- [#1](https://github.com/my-org/my-repo/pull/1) Grew a nose ([@someone](https://github.com/someone))
```

Packages released only because a workspace dependency was released have no pull requests of their own, so they get a section explaining the bump instead:

```md
## v0.1.1 (2026-08-14)

#### :arrow_up: Dependency Updates

- Has dependency `workspace:^` on face
```

Changes that GitHub could not attribute to any package (the `Other` bucket) bump no package, so they appear in no package's changelog. The GitHub release body still describes the release as a whole, exactly as it does without this setting.

Packages that don't have a `CHANGELOG.md` yet get one created.

## `ignore`

In a monorepo you may want `release-plan` to only manage a subset of your workspace packages. Setting `ignore` to `true` tells `release-plan` to leave that package alone entirely. This is useful when a package is released by "some other means" but can't be marked `"private": true` (because it is actually published).

::: code-group

```json [package.json]
{
  "name": "example",
  "private": false,
  "version": "1.0.0",
  "release-plan": {
    "ignore": true
  }
}
```

:::
