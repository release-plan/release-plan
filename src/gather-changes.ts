import { dirname, resolve } from 'node:path';

import Changelog from './changelog/changelog.js';
import { load as loadChangelogConfig } from './changelog/configuration.js';
import type { PackageLocation } from './changelog/configuration.js';
import { publishedInterPackageDeps } from './interdep.js';

export async function gatherChanges(): Promise<string> {
  const config = loadChangelogConfig({
    packages: publishedPackageLocations(),
    ignoreReleases: true,
    nextVersion: 'Release',
  });

  return new Changelog(config).createMarkdown();
}

function publishedPackageLocations(): PackageLocation[] {
  return [...publishedInterPackageDeps()].map(([name, entry]) => ({
    name,
    path: resolve(dirname(entry.pkgJSONPath)),
  }));
}
