import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import * as flowParser from 'flow-eslint';
import globals from 'globals';

export default [
  {ignores: ['dist/', 'flow-typed/']},
  js.configs.recommended,
  {
    languageOptions: {
      parser: flowParser,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  prettier,
];
