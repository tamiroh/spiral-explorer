// @noflow

import {FlatCompat} from '@eslint/eslintrc';
import js from '@eslint/js';
import {defineConfig, globalIgnores} from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import * as flowParser from 'flow-eslint';
import globals from 'globals';

const compat = new FlatCompat({baseDirectory: import.meta.dirname});

export default defineConfig([
  globalIgnores(['dist/', 'flow-typed/']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      compat.extends('plugin:ft-flow/recommended'),
    ],
    languageOptions: {
      parser: flowParser,
      sourceType: 'module',
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  prettier,
]);
