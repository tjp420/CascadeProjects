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
      'indent': 'off'
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
