import js from '@eslint/js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.venv/**',
      '**/coverage/**',
      '**/dist/**',
      '**/build/**',
      '**/archive/**',
      '**/htmlcov/**',
      '**/.simplebeacon/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'packages/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        window: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'no-undef': 'warn'
    }
  },
  {
    files: ['server/simple_http_server.js'],
    languageOptions: {
      sourceType: 'module'
    }
  }
];
