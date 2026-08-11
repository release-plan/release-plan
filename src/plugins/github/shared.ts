import { Octokit } from '@octokit/rest';
import PackageJson from '@npmcli/package-json';
import parseGithubUrl from 'parse-github-repo-url';
import { execa } from 'execa';
import type { Solution } from '../../plan.js';

export async function getRepo(): Promise<{ owner: string; repo: string }> {
  const pkgJson = await PackageJson.load('./');
  const normalisedJson = await pkgJson.normalize({
    steps: ['fixRepositoryField'],
  });

  if (!normalisedJson.content.repository) {
    throw new Error('This package does not have a repository defined');
  }

  const parsed = parseGithubUrl(
    (normalisedJson.content.repository as { url: string }).url,
  );

  if (!parsed) {
    throw new Error('This package does not have a valid repository');
  }

  const [user, repo] = parsed;
  return { owner: user, repo };
}

export function createOctokit(): Octokit {
  let baseUrl = undefined;
  if (process.env.GITHUB_DOMAIN) {
    baseUrl = `https://api.${process.env.GITHUB_DOMAIN}`;
  }
  if (process.env.GITHUB_API_URL) {
    baseUrl = process.env.GITHUB_API_URL;
  }
  return new Octokit({
    auth: process.env.GITHUB_AUTH,
    baseUrl,
  });
}

export async function getSha(cwd: string): Promise<string> {
  const result = await execa('git', ['rev-parse', 'HEAD'], { cwd });
  return result.stdout.trim();
}

export function shouldUseSuffixedTags(solution: Solution): boolean {
  return solution.size > 1;
}

export function tagFor(
  pkgName: string,
  entry: { newVersion: string },
  useSuffix: boolean,
): string {
  if (!useSuffix) {
    return `v${entry.newVersion}`;
  }
  return `v${entry.newVersion}-${pkgName}`;
}

export function chooseRepresentativeTag(
  solution: Solution,
  useSuffix: boolean,
): string {
  for (const [pkgName, entry] of solution) {
    if (entry.impact) {
      return tagFor(pkgName, entry, useSuffix);
    }
  }
  process.stderr.write('Found no releasable packages in the plan');
  process.exit(-1);
}
