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
  ignoreReleases?: boolean;
  nextVersion: string | undefined;
  wildcardLabel?: string;
  packages: PackageLocation[];
}

export interface ConfigLoaderOptions {
  nextVersion?: string;
  ignoreReleases?: boolean;
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
  const config: Partial<Configuration> =
    fromPackageConfig(rootPath) || fromLernaConfig(rootPath) || {};

  const { cacheDir, github } = config;
  let {
    repo,
    nextVersion,
    labels,
    ignoreCommitters,
    ignoreLabel,
    wildcardLabel,
  } = config;

  if (!repo) {
    repo = findRepo(rootPath);
    if (!repo) {
      throw new ConfigurationError(
        'Could not infer "repo" from the "package.json" file.',
      );
    }
  }

  if (options.nextVersion) {
    nextVersion = options.nextVersion;
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
    ignoreCommitters = [
      'dependabot-bot',
      'dependabot[bot]',
      'dependabot-preview[bot]',
      'greenkeeperio-bot',
      'greenkeeper[bot]',
      'renovate-bot',
      'renovate[bot]',
    ];
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
    ignoreReleases: options.ignoreReleases,
    wildcardLabel,
    packages: options.packages ?? [],
    github,
  };
}

function fromLernaConfig(rootPath: string): Partial<Configuration> | undefined {
  const lernaPath = path.join(rootPath, 'lerna.json');
  if (fs.existsSync(lernaPath)) {
    return JSON.parse(fs.readFileSync(lernaPath, 'utf8')).changelog;
  }
}

function fromPackageConfig(
  rootPath: string,
): Partial<Configuration> | undefined {
  const pkgPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).changelog;
  }
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
