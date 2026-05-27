/**
 * Group env files by deployment profile so dev/prod/example files are not cross-compared.
 */

const path = require('path');

function normalizeEnvRelativePath(relativePath) {
    return String(relativePath || '').replace(/\\/g, '/');
}

function resolveEnvProfileName(relativePath) {
    const rel = normalizeEnvRelativePath(relativePath);
    const base = path.posix.basename(rel);
    if (/^\.env\.production(\.|$)/.test(base) || base === '.env.production') {
        return 'production';
    }
    if (/^\.env\.v1-internal(\.|$)/.test(base)) {
        return 'v1-internal';
    }
    if (/^\.env\.development(\.|$)/.test(base)) {
        return 'development';
    }
    if (base === '.env' || /^\.env\./.test(base)) {
        return 'default';
    }
    return base;
}

function resolveEnvProfileGroup(relativePath) {
    const rel = normalizeEnvRelativePath(relativePath);
    const dir = path.posix.dirname(rel);
    const dirKey = dir === '.' ? 'root' : dir;
    return `${dirKey}:${resolveEnvProfileName(relativePath)}`;
}

function isExampleEnvFile(relativePath) {
    const base = path.posix.basename(normalizeEnvRelativePath(relativePath)).toLowerCase();
    return base.includes('.example') || base.includes('.template');
}

function isPlaceholderEnvValue(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return true;
    return /^(replace|your_|sk_test_|sk_live_|rk_live_|whsec_|price_|\.\.\.|changeme|dummy|placeholder|test-token)/i.test(trimmed)
        || /REPLACE_ME/i.test(trimmed)
        || /^replace-with-/i.test(trimmed);
}

function isTemplateEnvFile(relativePath) {
    const base = path.posix.basename(normalizeEnvRelativePath(relativePath)).toLowerCase();
    return base.includes('.template');
}

function shouldSkipEnvInconsistency(key, values) {
    if (!values || values.length <= 1) return true;

    const files = values.map((entry) => entry.file);
    if (files.some((file) => isTemplateEnvFile(file))) {
        return true;
    }

    const hasExample = files.some((file) => isExampleEnvFile(file));
    const hasLive = files.some((file) => !isExampleEnvFile(file));

    if (hasExample && hasLive) {
        if (/^(JWT_|.*_SECRET|.*_PASSWORD|STRIPE_|.*_KEY|DB_PASSWORD|DATABASE_URL)/i.test(key)) {
            return true;
        }
        if (values.some((entry) => isPlaceholderEnvValue(entry.value))) {
            return true;
        }
        if (/^(ENABLE_DATABASE|ENABLE_REDIS|NODE_ENV)$/i.test(key)) {
            return true;
        }
    }

    return false;
}

function isRuntimeInjectedEnvKey(key) {
    return /^(CI|NODE_ENV|FORCE_COLOR|NO_COLOR|DOTENV_CONFIG_PATH|npm_lifecycle_event|npm_node_execpath)$/i.test(key)
        || /^GITHUB_/i.test(key)
        || /^npm_config_/i.test(key);
}

function isNonProductionSourcePath(relativePath) {
    const rel = normalizeEnvRelativePath(relativePath).toLowerCase();
    return /(^|\/)(tests?|__tests__|fixtures?|docs?|examples?)(\/|$)/.test(rel)
        || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel)
        || /(^|\/)tests\/fixtures\//.test(rel);
}

module.exports = {
    normalizeEnvRelativePath,
    resolveEnvProfileName,
    resolveEnvProfileGroup,
    isExampleEnvFile,
    isTemplateEnvFile,
    isPlaceholderEnvValue,
    shouldSkipEnvInconsistency,
    isRuntimeInjectedEnvKey,
    isNonProductionSourcePath
};
