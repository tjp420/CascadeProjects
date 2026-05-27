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
        URL: 'readonly',
        window: 'readonly'
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
    files: ['web/scripts/**/*.js', 'web/components/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        structuredClone: 'readonly',
        AbortController: 'readonly',
        WebSocket: 'readonly',
        Chart: 'readonly',
        bootstrap: 'readonly'
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
