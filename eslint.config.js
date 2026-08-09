import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'release', 'node_modules', '.cache', 'playwright-report', 'test-results'] },

  // Extension source: type-aware linting. no-floating-promises guards the
  // background's promise-queue discipline; misused-promises catches the
  // async-listener class of bug.
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, chrome: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { arguments: false } }],
    },
  },

  // Node-side .mjs: build/scripts/tests/e2e/marketing. Browser globals too —
  // several of these inject code into pages via evaluate(), and the e2e
  // helpers touch chrome.* inside extension pages.
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.browser, chrome: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Playwright fixtures destructure their deps from the first param; an
      // empty pattern is how a fixture declares "no deps".
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },

  prettier,
);
