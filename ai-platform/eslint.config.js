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
        ...globals.jest,
        escapeHtml: 'readonly',
        formatPercent: 'readonly',
        formatNumber: 'readonly',
        pass: 'readonly',
        path: 'readonly',
        crypto: 'readonly',
        define: 'readonly',
        get: 'readonly',
        projectPath: 'readonly',
        resolveEslintTargets: 'readonly',
        runNpmAudit: 'readonly',
        scanCmd: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-control-regex': 'off',
      'no-empty': 'off',
      'no-unsafe-finally': 'off',
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
      'github-cache/**',
      'web/simplebeacon-dashboard/js/vendor/**',
      'web/simplebeacon-dashboard/js-es2018/vendor/**',
      'web/dashboard/js/vendor/**',
      'web/dashboard/js-es2018/vendor/**',
      'web/simplebeacon-dashboard/assets/**',
      'web/dashboard/assets/**',
      'web/simplebeacon-dashboard/dist/**',
      'web/simplebeacon-dashboard/pages-publish/**',
      'web/dashboard/dist/**',
      'web/dashboard/pages-publish/**',
      'local-agent/**'
    ]
  }
];
