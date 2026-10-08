// @noflow

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import * as flowParser from 'flow-eslint';
import globals from 'globals';

export default [
  {ignores: ['dist/', 'flow-typed/']},
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parser: flowParser,
      sourceType: 'module',
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  prettier,
];
