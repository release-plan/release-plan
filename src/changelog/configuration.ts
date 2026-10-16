import fs from 'node:fs';
import path from 'node:path';
import hostedGitInfo from 'hosted-git-info';

import ConfigurationError from './configuration-error.js';
import { getRootPath } from './git.js';

export interface PackageLocation {
  name: string;
  /** absolute */
  path: string;
}

export interface Configuration {
  repo: string;
  github?: string;
  rootPath: string;
  labels: { [key: string]: string };
  ignoreCommitters: string[];
  ignoreLabel: string;
  cacheDir?: string;
  nextVersion: string | undefined;
  wildcardLabel?: string;
  packages: PackageLocation[];
}

export interface ConfigLoaderOptions {
  nextVersion?: string;
  packages?: PackageLocation[];
}

export function load(options: ConfigLoaderOptions = {}): Configuration {
  const rootPath = getRootPath();
  return fromPath(rootPath, options);
}

export function fromPath(
  rootPath: string,
  options: ConfigLoaderOptions = {},
): Configuration {
  const config = fromPackageConfig(rootPath);

  const { cacheDir, github } = config;
  const nextVersion = options.nextVersion;
  let { repo, labels, ignoreCommitters, ignoreLabel, wildcardLabel } = config;

  if (!repo) {
    repo = findRepo(rootPath);
    if (!repo) {
      throw new ConfigurationError(
        'Could not infer "repo" from the "package.json" file.',
      );
    }
  }

  if (!labels) {
    labels = {
      breaking: ':boom: Breaking Change',
      enhancement: ':rocket: Enhancement',
      bug: ':bug: Bug Fix',
      documentation: ':memo: Documentation',
      internal: ':house: Internal',
    };
  }

  if (!wildcardLabel) {
    wildcardLabel = `_github-changelog_unlabeled_`;
  }

  if (wildcardLabel && !labels[wildcardLabel]) {
    labels[wildcardLabel] = ':present: Additional updates';
  }

  if (!ignoreCommitters) {
    ignoreCommitters = [];
  }

  if (!ignoreLabel) {
    ignoreLabel = 'ignore';
  }

  return {
    repo,
    nextVersion,
    rootPath,
    labels,
    ignoreCommitters,
    ignoreLabel,
    cacheDir,
    wildcardLabel,
    packages: options.packages ?? [],
    github,
  };
}

/**
 * Options for the whole repo.
 * The `release-plan` key of each package also holds options for that
 * package, so only these names are read from the root package.json.
 */
const repoOptions = [
  'repo',
  'github',
  'labels',
  'ignoreCommitters',
  'ignoreLabel',
  'wildcardLabel',
  'cacheDir',
] as const;

function fromPackageConfig(rootPath: string): Partial<Configuration> {
  const pkgPath = path.join(rootPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return {};
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  if (pkg.changelog) {
    console.warn(
      'The "changelog" key in package.json is deprecated. Move its options into the "release-plan" key.',
    );
  }

  const config: Partial<Configuration> = {};
  for (const source of [pkg.changelog, pkg['release-plan']]) {
    for (const name of repoOptions) {
      if (source?.[name] !== undefined) {
        config[name] = source[name];
      }
    }
  }
  return config;
}

function findRepo(rootPath: string): string | undefined {
  const pkgPath = path.join(rootPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.repository) {
    return;
  }

  return findRepoFromPkg(pkg);
}

export function findRepoFromPkg(pkg: {
  repository: { url: string } | string;
}): string | undefined {
  const url =
    typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url;
  const info = hostedGitInfo.fromUrl(url);
  if (info && info.type === 'github') {
    return `${info.user}/${info.project}`;
  }
  // hosted-git-info does not know self-hosted GitHub domains
  const matchHttps = /https:\/\/[^/]+\/([^/]+)\/([^/]+)\.git/.exec(url);
  if (matchHttps && matchHttps.length === 3) {
    return `${matchHttps[1]}/${matchHttps[2]}`;
  }
  const matchGit = /git@[^:]+:([^/]+)\/([^/]+)\.git/.exec(url);
  if (matchGit && matchGit.length === 3) {
    return `${matchGit[1]}/${matchGit[2]}`;
  }
}
