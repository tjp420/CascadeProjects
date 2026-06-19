// SPDX-License-Identifier: MIT
/**
 * ESLint flat config for the ai-platform monorepo.
 *
 * @license MIT
 */

import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
      'semi': 'off',
      'quotes': 'off',
      'indent': 'off',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
      'preserve-caught-error': 'off'
    }
  },
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'packages/simplebeacon-cli/**',
      '.github-sync/**',
      'github-cache/**'
    ]
  }
];
