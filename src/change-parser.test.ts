import { describe, it, expect } from 'vitest';

import { parseChangeLog } from './change-parser.js';

describe('change-parser', function () {
  it('captures the entries belonging to each package list', function () {
    const parsed = parseChangeLog(`## Release (2026-08-14)

#### :rocket: Enhancement
* \`pkg-a\`, \`pkg-b\`
  * [#1](https://example.com/1) Shared feature ([@someone](https://example.com/someone))
  * [#2](https://example.com/2) Another shared feature ([@someone](https://example.com/someone))
* \`pkg-c\`
  * [#3](https://example.com/3) Solo feature ([@someone](https://example.com/someone))

#### :bug: Bug Fix
* \`pkg-a\`
  * [#4](https://example.com/4) A fix ([@someone](https://example.com/someone))

#### Committers: 1
- Someone ([@someone](https://example.com/someone))
`);

    expect(parsed).to.deep.equal({
      sections: [
        {
          packages: ['pkg-a', 'pkg-b', 'pkg-c'],
          groups: [
            {
              packages: ['pkg-a', 'pkg-b'],
              entries: [
                '[#1](https://example.com/1) Shared feature ([@someone](https://example.com/someone))',
                '[#2](https://example.com/2) Another shared feature ([@someone](https://example.com/someone))',
              ],
            },
            {
              packages: ['pkg-c'],
              entries: [
                '[#3](https://example.com/3) Solo feature ([@someone](https://example.com/someone))',
              ],
            },
          ],
          impact: 'minor',
          heading: ':rocket: Enhancement',
        },
        {
          packages: ['pkg-a'],
          groups: [
            {
              packages: ['pkg-a'],
              entries: [
                '[#4](https://example.com/4) A fix ([@someone](https://example.com/someone))',
              ],
            },
          ],
          impact: 'patch',
          heading: ':bug: Bug Fix',
        },
      ],
    });
  });

  it('collects unattributed entries into a group with no packages', function () {
    const parsed = parseChangeLog(`## Release (2026-08-14)

#### :bug: Bug Fix
* [#1](https://example.com/1) A fix ([@someone](https://example.com/someone))
* [#2](https://example.com/2) Another fix ([@someone](https://example.com/someone))
`);

    expect(parsed.sections).to.deep.equal([
      {
        packages: [],
        groups: [
          {
            packages: [],
            entries: [
              '[#1](https://example.com/1) A fix ([@someone](https://example.com/someone))',
              '[#2](https://example.com/2) Another fix ([@someone](https://example.com/someone))',
            ],
          },
        ],
        impact: 'patch',
        heading: ':bug: Bug Fix',
      },
    ]);
  });

  it('treats the Other bucket as unattributed', function () {
    const parsed = parseChangeLog(`## Release (2026-08-14)

#### :house: Internal
* \`pkg-a\`
  * [#1](https://example.com/1) Real change ([@someone](https://example.com/someone))
* Other
  * [#2](https://example.com/2) Repo chore ([@someone](https://example.com/someone))
`);

    expect(parsed.sections[0]).to.deep.equal({
      packages: ['pkg-a'],
      groups: [
        {
          packages: ['pkg-a'],
          entries: [
            '[#1](https://example.com/1) Real change ([@someone](https://example.com/someone))',
          ],
        },
        {
          packages: [],
          entries: [
            '[#2](https://example.com/2) Repo chore ([@someone](https://example.com/someone))',
          ],
        },
      ],
      impact: 'patch',
      heading: ':house: Internal',
    });
  });
});
