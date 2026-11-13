import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['out/', 'dist/', 'coverage/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Main process, preload, build scripts and tests run in Node.js.
    files: ['src/main/**', 'src/preload/**', 'scripts/**', 'e2e/**', '*.config.*', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // The UI runs in the browser part of Electron, without Node.js.
    files: ['src/renderer/**'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // The UI must reach the system only through window.api (src/preload), never directly.
    files: ['src/renderer/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['electron', 'electron/*'], message: 'Use window.api (src/preload) instead.' },
            { group: ['node:*'], message: 'Node.js is not available in the UI.' },
          ],
        },
      ],
    },
  },
);
