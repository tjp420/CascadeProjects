import js from '@eslint/js';
import globals from 'globals';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sharedDashboardGlobals = require('./web/scripts/eslint-shared-globals.json');

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
      '**/.simplebeacon/**',
      'web/scripts/eslint-shared-globals.json',
      'web/scripts/**/*.part*.js',
      'web/scripts/**/jest.config*.js',
      'web/scripts/**/rollup.config*.js',
      'web/scripts/**/vite.config.js',
      'web/scripts/**/eslint.config.js',
      'web/scripts/**/simple_http_server.js',
      'web/scripts/**/quick-server.js',
      'web/scripts/**/git-history-server.js',
      'web/scripts/**/simple-api-server.js',
      'web/scripts/**/start-all.js',
      'web/scripts/**/start-dashboard.js',
      'web/scripts/**/temp_dashboard.js',
      'web/scripts/**/dashboard-inline-core.part*.js',
      'web/scripts/**/export-system.part*.js',
      'web/scripts/**/check_braces.js',
      'web/scripts/**/code_quality_scanner.original.js',
      'web/scripts/**/webpack.config.js',
      'web/scripts/**/webpack.optimization.config.js',
      'web/scripts/**/advanced-analytics-panel.js',
      'web/scripts/**/browser-mock-scanner.js',
      'web/scripts/**/code_quality_fixer.js',
      'web/scripts/**/code_quality_scanner.js',
      'web/scripts/**/dashboard-init.js',
      'web/scripts/**/dashboard-sidebar-button-fix.js',
      'web/scripts/**/dashboard.test.js',
      'web/scripts/**/data-upload.js',
      'web/scripts/**/directory-analyzer-system.js',
      'web/scripts/**/error-tracking-resolution-system.js',
      'web/scripts/**/jest.setup.js',
      'web/scripts/**/large_function_refactor.js',
      'web/scripts/**/mock-data-scan-results.js',
      'web/scripts/**/project-resources-manager.js',
      'web/scripts/**/quick-scanner-test.js',
      'web/scripts/**/test-enhanced-scanner.js',
      'web/scripts/**/test-scanner-modules.js',
      'web/scripts/**/test-scanner-simple.js',
      'web/scripts/**/test-security-monitoring.js',
      'web/scripts/**/test-technical-debt-fix.js',
      'src/web/**',
      'src/ai-system/**'
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
        caughtErrors: 'none'
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
        ...globals.browser,
        ...sharedDashboardGlobals,
        Chart: 'readonly',
        bootstrap: 'readonly',
        d3: 'readonly',
        event: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        exports: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
      'no-console': 'off',
      'no-undef': 'warn',
      'no-redeclare': 'off',
      'no-dupe-keys': 'off',
      'no-dupe-class-members': 'off',
      'no-useless-escape': 'warn',
      'no-import-assign': 'warn',
      'no-global-assign': 'warn',
      'no-const-assign': 'warn',
      'no-case-declarations': 'warn'
    }
  },
  {
    files: [
      'web/scripts/api-client.js',
      'web/scripts/api-client-init.js',
      'web/scripts/constants.js',
      'web/scripts/code_quality_fixer.js',
      'web/scripts/code_quality_improvements_optimized.js',
      'web/scripts/code_quality_scanner.js',
      'web/scripts/run_quality_scan.js'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    }
  },
  {
    files: ['web/simplebeacon-dashboard/js/**/*.js', 'web/simplebeacon-dashboard/js/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...sharedDashboardGlobals
      }
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
      'no-console': 'off',
      'no-undef': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['web/scripts/jest.setup*.js', 'web/scripts/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest
      }
    }
  },
  {
    files: ['server/simple_http_server.js'],
    languageOptions: {
      sourceType: 'module'
    }
  },
  {
    files: ['packages/**/complete-scan-artifact-profile.browser.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    }
  },
  {
    files: ['src/**/*.js'],
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
        URL: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
      'no-console': 'off',
      'no-undef': 'warn',
      'no-case-declarations': 'warn',
      'no-dupe-keys': 'warn',
      'no-ex-assign': 'warn',
      'no-useless-escape': 'warn'
    }
  },
  {
    files: ['src/analysis/**/*.js', 'src/lib/*-logger.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly'
      }
    }
  },
  {
    files: ['src/validation/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        DOMParser: 'readonly',
        localStorage: 'readonly',
        window: 'readonly',
        document: 'readonly'
      }
    }
  }
];
