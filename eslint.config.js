// @noflow

import {FlatCompat} from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import * as flowParser from 'flow-eslint';
import globals from 'globals';

const compat = new FlatCompat({baseDirectory: import.meta.dirname});

export default [
  {ignores: ['dist/', 'flow-typed/']},
  js.configs.recommended,
  ...compat.extends('plugin:ft-flow/recommended'),
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
