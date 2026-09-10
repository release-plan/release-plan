# CLI

Release Plan has a CLI. Sometimes it is helpful to run this commands manually to
understand what `release-plan` is doing.

Call them with `release-plan <command>`

## `prepare`

Edits the `package.json` and changelog files to prepare for release.

## `publish`

Publishes an already-prepared released by tagging, pushing tags, creating GitHub
release, and publishing to NPM.

## `gather-changes`  

Builds a description of all the PRs merged since the last tag, grouped by their GitHub labels.

## `parse-changes`

Parse the summary of changes into a structured format
  
## `discover-deps`

Summarizes how all our published packages relate to each other

## `explain-plan`

Explains which packages need to be released at what versions and why.
