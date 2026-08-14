import { existsSync } from 'node:fs';

// eslint-disable-next-line n/no-missing-import
import { readJSONSync } from './util.js';

// unlike the per-package settings read in plan.ts, this one describes the whole
// repo, so it is only honored at the workspace root
export function changelogPerPackage(): boolean {
  if (!existsSync('./package.json')) {
    return false;
  }
  return (
    readJSONSync('./package.json')['release-plan']?.changelogPerPackage === true
  );
}
