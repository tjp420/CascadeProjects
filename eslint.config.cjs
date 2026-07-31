/**
 * Root ESLint Flat Config for the Cascade monorepo.
 * - Uses Flat Config format (eslint.config.cjs)
 * - Provides sensible defaults for JS, CommonJS, and TypeScript files
 * - Adds React overrides for the dashboard
 */
module.exports = [
  // Ignore common build and artifact folders
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      '.simplebeacon/**',
      'web/simplebeacon-dashboard/test-results/**',
    ],
  },

  // JavaScript (including CommonJS) rules
  {
    files: ['**/*.{js,cjs,mjs,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    plugins: {
      import: require('eslint-plugin-import'),
      node: require('eslint-plugin-node'),
      promise: require('eslint-plugin-promise'),
      react: require('eslint-plugin-react'),
      'react-hooks': require('eslint-plugin-react-hooks'),
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn'],
      'import/no-unresolved': 'off',
      'node/no-missing-require': 'off',
      'promise/always-return': 'warn',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // TypeScript rules
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    plugins: { '@typescript-eslint': require('@typescript-eslint/eslint-plugin') },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  // Project-specific overrides: ai-platform backend
  {
    files: ['ai-platform/**', 'server/**'],
    rules: {
      'node/global-require': 'off',
    },
  },

  // Dashboard frontend overrides
  {
    files: ['web/simplebeacon-dashboard/**'],
    rules: {
      'react/prop-types': 'off',
    },
  },
];
