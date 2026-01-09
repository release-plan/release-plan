# release-plan Changelog

## Release (2026-01-09)

* release-plan 0.17.4 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#228](https://github.com/release-plan/release-plan/pull/228) Update `github-changelog` to `v2.1.4` to support bot users ([@gossi](https://github.com/gossi))

#### :memo: Documentation
* `release-plan`
  * [#230](https://github.com/release-plan/release-plan/pull/230) Rename `embroider-build` to `release-plan` ([@gossi](https://github.com/gossi))
  * [#178](https://github.com/release-plan/release-plan/pull/178) Documentation site with `vitepress` ([@gossi](https://github.com/gossi))

#### :house: Internal
* `release-plan`
  * [#214](https://github.com/release-plan/release-plan/pull/214) Prepare Release ([@github-actions[bot]](https://github.com/apps/github-actions))
  * [#213](https://github.com/release-plan/release-plan/pull/213) Sanitize Package Manager Version ([@gossi](https://github.com/gossi))

#### Committers: 2
- GitHub Actions [Bot] ([@github-actions](https://github.com/apps/github-actions))
- Thomas Gossmann ([@gossi](https://github.com/gossi))

## Release (2026-01-09)

* release-plan 0.17.3 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#228](https://github.com/release-plan/release-plan/pull/228) Update `github-changelog` to `v2.1.4` to support bot users ([@gossi](https://github.com/gossi))

#### :memo: Documentation
* `release-plan`
  * [#178](https://github.com/release-plan/release-plan/pull/178) Documentation site with `vitepress` ([@gossi](https://github.com/gossi))

#### :house: Internal
* `release-plan`
  * [#213](https://github.com/release-plan/release-plan/pull/213) Sanitize Package Manager Version ([@gossi](https://github.com/gossi))

#### Committers: 1
- Thomas Gossmann ([@gossi](https://github.com/gossi))

## Release (2025-08-01)

* release-plan 0.17.2 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#193](https://github.com/embroider-build/release-plan/pull/193) fix error in github-changelog argument ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-08-01)

* release-plan 0.17.1 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#192](https://github.com/embroider-build/release-plan/pull/192) make sure the changelog only creates one version ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-06-11)

* release-plan 0.17.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#184](https://github.com/embroider-build/release-plan/pull/184) add the ability to set the github release to prerelease ([@mansona](https://github.com/mansona))
  * [#161](https://github.com/embroider-build/release-plan/pull/161) refactor: Create tags via GitHub REST API ([@TSenter](https://github.com/TSenter))

#### :memo: Documentation
* `release-plan`
  * [#183](https://github.com/embroider-build/release-plan/pull/183) add documentation for command-line arguments ([@mansona](https://github.com/mansona))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Tyler Senter ([@TSenter](https://github.com/TSenter))

## Release (2025-03-13)

* release-plan 0.16.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#155](https://github.com/embroider-build/release-plan/pull/155) add ability to set tag per package ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-03-03)

* release-plan 0.15.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#158](https://github.com/embroider-build/release-plan/pull/158) feat: Display new package versions as list ([@TSenter](https://github.com/TSenter))

#### :house: Internal
* `release-plan`
  * [#153](https://github.com/embroider-build/release-plan/pull/153) move publish test to mock execa ([@mansona](https://github.com/mansona))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Tyler Senter ([@TSenter](https://github.com/TSenter))

## Release (2025-03-03)

release-plan 0.14.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#131](https://github.com/embroider-build/release-plan/pull/131) add skip npm option ([@patricklx](https://github.com/patricklx))
  * [#133](https://github.com/embroider-build/release-plan/pull/133) update execa ([@mansona](https://github.com/mansona))
  * [#124](https://github.com/embroider-build/release-plan/pull/124) support github enterprise api url via env var ([@patricklx](https://github.com/patricklx))

#### :bug: Bug Fix
* `release-plan`
  * [#138](https://github.com/embroider-build/release-plan/pull/138) fix readJSONSync import ([@patricklx](https://github.com/patricklx))
  * [#107](https://github.com/embroider-build/release-plan/pull/107) Bump chalk from 4.1.2 to 5.4.1 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### :memo: Documentation
* `release-plan`
  * [#141](https://github.com/embroider-build/release-plan/pull/141) Add note about creating initial tag ([@kategengler](https://github.com/kategengler))

#### :house: Internal
* `release-plan`
  * [#146](https://github.com/embroider-build/release-plan/pull/146) add extra test coverage to plan ([@mansona](https://github.com/mansona))
  * [#152](https://github.com/embroider-build/release-plan/pull/152) remove conditional coverage run ([@mansona](https://github.com/mansona))
  * [#151](https://github.com/embroider-build/release-plan/pull/151) fix coverage summary and double-execution ([@mansona](https://github.com/mansona))
  * [#150](https://github.com/embroider-build/release-plan/pull/150) fix coverage json summary path ([@mansona](https://github.com/mansona))
  * [#149](https://github.com/embroider-build/release-plan/pull/149) fix coverage comparison path ([@mansona](https://github.com/mansona))
  * [#148](https://github.com/embroider-build/release-plan/pull/148) enable coverage comparison to main ([@mansona](https://github.com/mansona))
  * [#147](https://github.com/embroider-build/release-plan/pull/147) Fix workflow for adding coverage ([@mansona](https://github.com/mansona))
  * [#145](https://github.com/embroider-build/release-plan/pull/145) add coverage report to PRs ([@mansona](https://github.com/mansona))
  * [#144](https://github.com/embroider-build/release-plan/pull/144) Bump @vitest/coverage-v8 from 2.1.8 to 3.0.7 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#143](https://github.com/embroider-build/release-plan/pull/143) Bump eslint-config-prettier from 9.1.0 to 10.0.2 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#142](https://github.com/embroider-build/release-plan/pull/142) Bump the dev-dependencies group across 1 directory with 5 updates ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#134](https://github.com/embroider-build/release-plan/pull/134) Update eslint - flat config and better prettier implementation ([@mansona](https://github.com/mansona))
  * [#132](https://github.com/embroider-build/release-plan/pull/132) update pnpm ([@mansona](https://github.com/mansona))

#### Committers: 3
- Chris Manson ([@mansona](https://github.com/mansona))
- Katie Gengler ([@kategengler](https://github.com/kategengler))
- Patrick Pircher ([@patricklx](https://github.com/patricklx))

## Release (2025-02-12)

release-plan 0.13.1 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#122](https://github.com/embroider-build/release-plan/pull/122) rename embroider-release in error message to release-plan ([@patricklx](https://github.com/patricklx))

#### Committers: 1
- Patrick Pircher ([@patricklx](https://github.com/patricklx))

## Release (2025-02-12)

release-plan 0.13.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#120](https://github.com/embroider-build/release-plan/pull/120) make name of release the same as the tag ([@patricklx](https://github.com/patricklx))

#### Committers: 1
- Patrick Pircher ([@patricklx](https://github.com/patricklx))

## Release (2025-02-11)

release-plan 0.12.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#119](https://github.com/embroider-build/release-plan/pull/119) allow you to define a semver tag when using prerelease ([@mansona](https://github.com/mansona))
  * [#109](https://github.com/embroider-build/release-plan/pull/109) Bump @octokit/rest from 19.0.13 to 21.1.0 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### :house: Internal
* `release-plan`
  * [#118](https://github.com/embroider-build/release-plan/pull/118) Bump the dev-dependencies group across 1 directory with 3 updates ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#92](https://github.com/embroider-build/release-plan/pull/92) Bump @npmcli/package-json from 5.0.0 to 6.1.0 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#102](https://github.com/embroider-build/release-plan/pull/102) Bump the dev-dependencies group with 6 updates ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#101](https://github.com/embroider-build/release-plan/pull/101) use increase-if-necessary strategy for dependabot ([@mansona](https://github.com/mansona))
  * [#89](https://github.com/embroider-build/release-plan/pull/89) Bump fs-extra and @types/fs-extra ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#100](https://github.com/embroider-build/release-plan/pull/100) update release-plan workflows ([@mansona](https://github.com/mansona))
  * [#99](https://github.com/embroider-build/release-plan/pull/99) stop using git fork of fixturify-project ([@mansona](https://github.com/mansona))
  * [#73](https://github.com/embroider-build/release-plan/pull/73) add a dependabot config ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-11-24)

release-plan 0.11.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#85](https://github.com/embroider-build/release-plan/pull/85) pass provenance through if provided to publish ([@mansona](https://github.com/mansona))
  * [#68](https://github.com/embroider-build/release-plan/pull/68) add semverIncrementAs option for granular package version control ([@void-mAlex](https://github.com/void-mAlex))

#### :house: Internal
* `release-plan`
  * [#83](https://github.com/embroider-build/release-plan/pull/83) use corepack to manage pnpm version ([@mansona](https://github.com/mansona))

#### Committers: 2
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-10-17)

release-plan 0.10.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#81](https://github.com/embroider-build/release-plan/pull/81) Add support for specifying --access, aligning better with default publish behavior ([@saracope](https://github.com/saracope))

#### Committers: 1
- Sara Cope ([@saracope](https://github.com/saracope))

## Release (2024-07-15)

release-plan 0.9.2 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#74](https://github.com/embroider-build/release-plan/pull/74) move @types packages to dev-dependencies ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-07-11)

release-plan 0.9.1 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#72](https://github.com/embroider-build/release-plan/pull/72) add a test to exercise latest-version dependency and update it ([@mansona](https://github.com/mansona))

#### :memo: Documentation
* `release-plan`
  * [#58](https://github.com/embroider-build/release-plan/pull/58) Update readme ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2024-03-12)

release-plan 0.9.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#66](https://github.com/embroider-build/release-plan/pull/66) start using github-changelog ([@mansona](https://github.com/mansona))

#### :house: Internal
* `release-plan`
  * [#67](https://github.com/embroider-build/release-plan/pull/67) fix typo in release-plan setup ([@mansona](https://github.com/mansona))
  * [#64](https://github.com/embroider-build/release-plan/pull/64) update release-plan-setup ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-02-16)

release-plan 0.8.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#56](https://github.com/embroider-build/release-plan/pull/56) add the default github-changelog unlabelled section name to parser ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-02-14)

release-plan 0.7.1 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#54](https://github.com/embroider-build/release-plan/pull/54) fix import of semver ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-01-26)

release-plan 0.7.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#52](https://github.com/embroider-build/release-plan/pull/52) add ability to pass tag to publish command ([@mansona](https://github.com/mansona))

#### :bug: Bug Fix
* `release-plan`
  * [#51](https://github.com/embroider-build/release-plan/pull/51) Make changelog header discovery more forgiving (case-insensitive) ([@mansona](https://github.com/mansona))

#### :house: Internal
* `release-plan`
  * [#49](https://github.com/embroider-build/release-plan/pull/49) add a basic test for updateChangelog ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
## Release (2024-01-24)

release-plan 0.6.1 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#47](https://github.com/embroider-build/release-plan/pull/47) Robustly discover packages with @manypkg ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 1
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)
## Release (2023-12-13)

release-plan 0.6.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#38](https://github.com/embroider-build/release-plan/pull/38) add --publish-branch if passed to release-plan publish ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
## Release (2023-12-06)

release-plan 0.5.1 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#35](https://github.com/embroider-build/release-plan/pull/35) fix pnpm package discovery bug ([@mansona](https://github.com/mansona))
  * [#34](https://github.com/embroider-build/release-plan/pull/34) Fix pnpm package discovery ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
## Release (2023-12-06)

release-plan 0.5.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#32](https://github.com/embroider-build/release-plan/pull/32) update lerna-changelog ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
## Release (2023-12-04)

release-plan 0.4.1 (patch)

#### :bug: Bug Fix
* [#30](https://github.com/embroider-build/release-plan/pull/30) add shebang back and fix linting config ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
## Release (2023-12-04)

release-plan 0.4.0 (minor)

#### :rocket: Enhancement
* [#28](https://github.com/embroider-build/release-plan/pull/28) pick the correct package manager to do npm publish ([@mansona](https://github.com/mansona))

#### :house: Internal
* [#29](https://github.com/embroider-build/release-plan/pull/29) Add linting and check it in CI  ([@mansona](https://github.com/mansona))
* [#27](https://github.com/embroider-build/release-plan/pull/27) run npm init release-plan-setup --update ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
## Release (2023-11-24)

release-plan 0.3.0 (minor)

#### :rocket: Enhancement
* [#24](https://github.com/embroider-build/release-plan/pull/24) add support for npm workspaces ([@mansona](https://github.com/mansona))

#### :bug: Bug Fix
* [#23](https://github.com/embroider-build/release-plan/pull/23) use require.resolve to find lerna-changelog ([@mansona](https://github.com/mansona))
* [#21](https://github.com/embroider-build/release-plan/pull/21) don't throw when we encounter an unknown package ([@mansona](https://github.com/mansona))
* [#20](https://github.com/embroider-build/release-plan/pull/20) fix updating changelog ([@mansona](https://github.com/mansona))

#### :house: Internal
* [#25](https://github.com/embroider-build/release-plan/pull/25) remove reference to @embroider ([@mansona](https://github.com/mansona))
* [#22](https://github.com/embroider-build/release-plan/pull/22) remove unused package.json ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2023-11-23)

release-plan 0.2.3 (patch)

#### :memo: Documentation
* [#17](https://github.com/embroider-build/release-plan/pull/17) add a basic readme ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2023-11-23)

release-plan 0.2.2 (patch)

#### :bug: Bug Fix
* [#15](https://github.com/embroider-build/release-plan/pull/15) actually use otp when it's provided ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
## Release (2023-11-23)

release-plan 0.2.1 (patch)

#### :bug: Bug Fix
* [#13](https://github.com/embroider-build/release-plan/pull/13) Fix npm publish ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
## Release (2023-11-23)

release-plan 0.2.0 (minor)

#### :rocket: Enhancement
* [#11](https://github.com/embroider-build/release-plan/pull/11) Fix publish step ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
## Release (2023-11-20)

release-plan 0.1.0 (minor)

#### :rocket: Enhancement
* [#5](https://github.com/embroider-build/release-plan/pull/5) add --single-package option ([@mansona](https://github.com/mansona))
* [#1](https://github.com/embroider-build/release-plan/pull/1) use tsup ([@mansona](https://github.com/mansona))

#### :house: Internal
* [#7](https://github.com/embroider-build/release-plan/pull/7) use dist/cli.js directly in workflows ([@mansona](https://github.com/mansona))
* [#6](https://github.com/embroider-build/release-plan/pull/6) add workflows for review and release ([@mansona](https://github.com/mansona))
* [#4](https://github.com/embroider-build/release-plan/pull/4) reset version so release-plan will work on itself ([@mansona](https://github.com/mansona))
* [#3](https://github.com/embroider-build/release-plan/pull/3) convert everything to work correctly with ESM ([@mansona](https://github.com/mansona))
* [#2](https://github.com/embroider-build/release-plan/pull/2) revert back from tsup to tsc ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))
