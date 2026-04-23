import globals from 'globals';
import nodePlugin from 'eslint-plugin-n';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/'],
  },
  nodePlugin.configs['flat/recommended-module'],
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },

    rules: {
      'n/no-process-exit': 0,
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-unused-expressions': 0,

      'n/hashbang': [
        'error',
        {
          convertPath: {
            'src/*.ts': ['^src/(.+).ts$', 'dist/$1.js'],
          },
        },
      ],
    },
  },
  {
    files: [
      'src/**/*.test.ts',
      'fixtures/**/*',
      'eslint.config.mjs',
      'vitest.config.js',
      'docs/.vitepress/config.js',
      'docs/.vitepress/theme/index.js',
    ],

    rules: {
      'n/no-unpublished-import': 0,
    },
  },
  eslintConfigPrettier,
);
