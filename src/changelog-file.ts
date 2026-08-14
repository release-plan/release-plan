import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const changelogPreamblePattern = /#.*Changelog.*$/i;

/**
 * Inserts a release entry directly beneath the changelog's preamble heading.
 *
 * @param file path to the changelog
 * @param entry the release entry, newline terminated
 * @param createIfMissing write a fresh changelog when none exists yet
 */
export function prependToChangelog(
  file: string,
  entry: string,
  createIfMissing = false,
): void {
  if (createIfMissing && !existsSync(file)) {
    writeFileSync(file, `# Changelog\n\n${entry}`);
    return;
  }

  const oldContent = readFileSync(file, 'utf8').split('\n');

  if (!changelogPreamblePattern.test(oldContent[0])) {
    process.stderr.write(
      `Cannot parse existing changelog ${file}. Expected it to match:\n${changelogPreamblePattern}\n`,
    );
    process.exit(-1);
  }

  writeFileSync(
    file,
    oldContent[0] + '\n\n' + entry + oldContent.slice(1).join('\n'),
  );
}
