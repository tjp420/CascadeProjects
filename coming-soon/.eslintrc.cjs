module.exports = {
    env: {
        browser: true,
        node: true,
        es2022: true
    },
    extends: ['eslint:recommended'],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script'
    },
    rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-console': 'off',
        'prefer-const': 'warn',
        'no-var': 'warn',
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],
        'no-throw-literal': 'error',
        'no-prototype-builtins': 'error'
    },
    ignorePatterns: [
        'node_modules/',
        '.simplebeacon/',
        'public/',
        '*.min.js',
        'dist/',
        'build/'
    ]
};
