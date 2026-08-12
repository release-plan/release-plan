import { readFileSync, writeFileSync } from 'fs';

/**
 * @param {string} filePath
 * @returns
 */
export function readJSONSync(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 *
 * @param {string} filePath
 * @param {any} object the value that will be written to the file
 * @param {Object} options
 * @param {number} options.spaces the number of spaces used for indentation - default: 2
 */
export function writeJSONSync(filePath, object, { spaces } = { spaces: 2 }) {
  writeFileSync(filePath, JSON.stringify(object, null, spaces));
}
