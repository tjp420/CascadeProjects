/**
 * Shared file-extension profiles for codebase walk, roadmap, and audit scanners.
 * Set SCAN_PROFILE=game-dev | universal to widen discovery beyond the default web+mod stack.
 * Dashboard scans default to universal unless SCAN_PROFILE or scanProfile is set explicitly.
 */

const {
    getExtensionsForProfile,
    buildExtensionToLanguageMap,
    getRegistryEntry,
    listRegistryLanguages,
    UNIVERSAL_LANGUAGE_REGISTRY
} = require('./universal-language-registry');

const DASHBOARD_DEFAULT_SCAN_PROFILE = 'universal';
const CLI_DEFAULT_SCAN_PROFILE = 'default';

const EXTENSION_TO_LANGUAGE = buildExtensionToLanguageMap();

const GAME_SCRIPT_EXTENSIONS = new Set(
    listRegistryLanguages()
        .filter((entry) => entry.family === 'game')
        .flatMap((entry) => entry.extensions || [])
        .map((ext) => ext.toLowerCase())
);

function resolveScanProfile(options = {}, context = 'cli') {
    if (options.scanProfile) {
        return String(options.scanProfile).toLowerCase();
    }
    if (process.env.SCAN_PROFILE) {
        return String(process.env.SCAN_PROFILE).toLowerCase();
    }
    if (String(context || '').toLowerCase() === 'dashboard') {
        return DASHBOARD_DEFAULT_SCAN_PROFILE;
    }
    return CLI_DEFAULT_SCAN_PROFILE;
}

function getCodeExtensions(scanProfile) {
    return getExtensionsForProfile(scanProfile);
}

function getLanguageForExtension(extension) {
    const ext = String(extension || '').toLowerCase();
    return EXTENSION_TO_LANGUAGE[ext] || 'generic';
}

function isGameScriptExtension(extension) {
    return GAME_SCRIPT_EXTENSIONS.has(String(extension || '').toLowerCase());
}

/** @deprecated use UNIVERSAL_LANGUAGE_REGISTRY families */
const UNIVERSAL_LANGUAGE_CONFIG = {
    web: listRegistryLanguages().filter((e) => e.family === 'web').flatMap((e) => e.extensions),
    game: listRegistryLanguages().filter((e) => e.family === 'game').flatMap((e) => e.extensions),
    systems: listRegistryLanguages().filter((e) => e.family === 'systems').flatMap((e) => e.extensions),
    mobile: listRegistryLanguages().filter((e) => e.family === 'mobile').flatMap((e) => e.extensions),
    data: listRegistryLanguages().filter((e) => e.family === 'data').flatMap((e) => e.extensions),
    devops: listRegistryLanguages().filter((e) => e.family === 'devops').flatMap((e) => e.extensions),
    scripting: listRegistryLanguages().filter((e) => e.family === 'scripting').flatMap((e) => e.extensions),
    domain: listRegistryLanguages().filter((e) => e.family === 'domain').flatMap((e) => e.extensions)
};

module.exports = {
    UNIVERSAL_LANGUAGE_CONFIG,
    UNIVERSAL_LANGUAGE_REGISTRY,
    EXTENSION_TO_LANGUAGE,
    GAME_SCRIPT_EXTENSIONS,
    DASHBOARD_DEFAULT_SCAN_PROFILE,
    CLI_DEFAULT_SCAN_PROFILE,
    resolveScanProfile,
    getCodeExtensions,
    getLanguageForExtension,
    isGameScriptExtension,
    getRegistryEntry,
    listRegistryLanguages
};
