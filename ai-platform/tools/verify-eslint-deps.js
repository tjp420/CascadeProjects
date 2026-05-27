#!/usr/bin/env node
/** Warn when flat-config ESLint peer deps are missing (does not fail install). */
const missing = [];
for (const name of ['@eslint/js', 'globals', 'eslint']) {
    try {
        require.resolve(name);
    } catch {
        missing.push(name);
    }
}
if (missing.length) {
    console.warn(
        `[eslint] Missing devDependencies: ${missing.join(', ')}. ` +
        'Run: npm install --legacy-peer-deps'
    );
}
