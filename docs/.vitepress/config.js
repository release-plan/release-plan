import { defineConfig } from 'vitepress';
import footnote from 'markdown-it-footnote';
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
} from 'vitepress-plugin-group-icons';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'Release-Plan',
    description: 'Release from anywhere',
    themeConfig: {
      search: {
        provider: 'local',
      },

      nav: [
        { text: 'Documentation', link: '/getting-started' },
        { text: 'Config', link: '/config' },
      ],

      sidebar: [
        {
          text: 'Documentation',
          items: [
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'Features', link: '/features' },
            { text: 'Release Workflow', link: '/release-workflow' },
            { text: 'Continuous Integration', link: '/continuous-integration' },
            { text: 'Troubleshooting', link: '/troubleshooting' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Versioning', link: '/versioning' },
            { text: 'Changelog', link: '/changelog' },
            { text: 'Pre Releases', link: '/pre-releases' },
            { text: 'Provenance', link: '/provenance' },
            { text: 'Commit Signing', link: '/commit-signing' },
            { text: 'Github Enterprise', link: '/github-enterprise' },
          ],
        },
        {
          text: 'References',
          items: [
            { text: 'Config', link: '/config' },
            { text: 'CLI', link: '/cli' },
          ],
        },
      ],

      socialLinks: [
        {
          icon: 'github',
          link: 'https://github.com/release-plan/release-plan',
        },
      ],
    },
    markdown: {
      config: (md) => {
        md.use(footnote), md.use(groupIconMdPlugin);
      },
    },
    vite: {
      resolve: {
        alias: {
          mermaid: 'mermaid/dist/mermaid.esm.mjs',
        },
      },
      plugins: [groupIconVitePlugin()],
    },
  }),
);
