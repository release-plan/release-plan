import fetch from 'make-fetch-happen';

export type NpmVersionInfo =
  | { published: false }
  | { published: true; gitHead: string | undefined }
  /** the registry did not answer, so we know nothing */
  | undefined;

export async function npmVersionInfo(
  name: string,
  version: string,
): Promise<NpmVersionInfo> {
  const registry = (
    process.env.npm_config_registry || 'https://registry.npmjs.org'
  ).replace(/\/$/, '');

  try {
    const res = await fetch(
      `${registry}/${name.replace('/', '%2f')}/${encodeURIComponent(version)}`,
    );
    if (res.status === 404) {
      return { published: false };
    }
    if (!res.ok) {
      return undefined;
    }
    const manifest = (await res.json()) as { gitHead?: string };
    return { published: true, gitHead: manifest.gitHead };
  } catch {
    return undefined;
  }
}
