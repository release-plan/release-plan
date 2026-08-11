import { relative, join } from 'path';
import fsExtra from 'fs-extra';
import { getPackagesSync } from '@manypkg/get-packages';

const { readJSONSync } = fsExtra;
export type Range = `workspace:${string}`;

export interface PkgEntry {
  version: string;
  pkgJSONPath: string;
  isDependencyOf: Map<string, Range>;
  isPeerDependencyOf: Map<string, Range>;
  pkg: any;
}

export function getPackages(rootDir: string): Map<string, PkgEntry> {
  const packages: Map<string, PkgEntry> = new Map();

  function loadPackage(packagePath: string) {
    const pkg = readJSONSync(packagePath);
    if (pkg.private) {
      return;
    }

    if (pkg['release-plan']?.ignore) {
      return;
    }

    packages.set(pkg.name, {
      version: pkg.version,
      pkgJSONPath: `./${relative('.', packagePath)}`,
      isDependencyOf: new Map(),
      isPeerDependencyOf: new Map(),
      pkg,
    });
  }

  const { packages: workspaces, rootPackage } = getPackagesSync(rootDir);

  workspaces.forEach((item) => loadPackage(join(item.dir, 'package.json')));
  if (rootPackage?.dir) {
    loadPackage(join(rootPackage.dir, 'package.json'));
  }

  return packages;
}

export function publishedInterPackageDeps(): Map<string, PkgEntry> {
  const packages = getPackages('./');

  for (const [consumerName, packageDefinition] of packages) {
    const consumerPkgJSON = packageDefinition.pkg;
    // no devDeps because changes to devDeps shouldn't ever force us to
    // release
    for (const section of ['dependencies', 'peerDependencies'] as const) {
      if (consumerPkgJSON[section]) {
        for (const [depName, depRange] of Object.entries(
          consumerPkgJSON[section] as Record<string, string>,
        )) {
          if (depRange.startsWith('workspace:')) {
            const dependency = packages.get(depName);
            if (!dependency) {
              throw new Error(
                `broken "workspace:" reference to ${depName} in ${consumerName}`,
              );
            }
            const field =
              section === 'dependencies'
                ? ('isDependencyOf' as const)
                : ('isPeerDependencyOf' as const);
            dependency[field].set(consumerName, depRange as Range);
          }
        }
      }
    }
  }

  return packages;
}
