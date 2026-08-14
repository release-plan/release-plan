import { describe, it, expect, vi } from 'vitest';

import { updateChangelog } from './prepare.js';

const mocks = vi.hoisted(() => {
  return {
    existsSync: vi.fn().mockImplementation(() => true),
    readFileSync: vi.fn().mockImplementation(() => ''),
    writeFileSync: vi.fn().mockImplementation(() => ''),
  };
});

vi.mock('node:fs', () => {
  return mocks;
});

describe('prepare', function () {
  describe('updateChangelog', function () {
    it('updates changelog correctly', function () {
      mocks.readFileSync.mockReturnValue(`# A Totally ficticious Changelog

## Some Old version

- added some features
- spent a lot of time trying to figure out releases (if only there was a tool to help with that)
`);
      updateChangelog(
        `## v1.0.0

- added release-plan (how did I live without it!?)
- releasing initial working version`,
        new Map([['thing', { newVersion: 'v1.0.0', impact: 'major' }]]) as any,
      );
      const [, newChangelog] = mocks.writeFileSync.mock.lastCall;
      expect(newChangelog).to.eq(`# A Totally ficticious Changelog

## v1.0.0

* thing v1.0.0 (major)

- added release-plan (how did I live without it!?)
- releasing initial working version

## Some Old version

- added some features
- spent a lot of time trying to figure out releases (if only there was a tool to help with that)
`);
    });
  });

  it('updates changelog correctly with case insensitive CHANGELOG', function () {
    mocks.readFileSync.mockReturnValue(`# A Totally ficticious CHANGELOG

## Some Old version

- added some features
- spent a lot of time trying to figure out releases (if only there was a tool to help with that)
`);
    updateChangelog(
      `## v1.0.0

- added release-plan (how did I live without it!?)
- releasing initial working version`,
      new Map([['thing', { newVersion: 'v1.0.0', impact: 'major' }]]) as any,
    );
    const [, newChangelog] = mocks.writeFileSync.mock.lastCall;
    expect(newChangelog).to.eq(`# A Totally ficticious CHANGELOG

## v1.0.0

* thing v1.0.0 (major)

- added release-plan (how did I live without it!?)
- releasing initial working version

## Some Old version

- added some features
- spent a lot of time trying to figure out releases (if only there was a tool to help with that)
`);
  });
});
