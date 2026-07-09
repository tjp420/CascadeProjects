/**
 * @module barrel
 */

let _registeredNamespaces = null;
let _inlineKeys = [];
let _cachedExportNames = null;
let _defaultBarrel = null;

/**
 * Register namespace objects so getExportNames can auto-derive the flat export list.
 * @param {Record<string, object>} namespaces
 */
export function registerNamespaces(namespaces) {
    _registeredNamespaces = namespaces;
    _cachedExportNames = null;
}

/**
 * Register inline function names for inclusion in export names.
 * @param {string[]} keys
 */
export function registerInlineKeys(keys) {
    _inlineKeys = keys;
    _cachedExportNames = null;
}

/**
 * Set the default barrel metadata used by validateBarrelIntegrity when no argument is passed.
 * @param {Object|null} barrel
 */
export function setDefaultBarrel(barrel) {
    _defaultBarrel = barrel;
}

function _buildExportNames() {
    const set = new Set();
    if (_registeredNamespaces) {
        for (const ns of Object.values(_registeredNamespaces)) {
            for (const name of Object.keys(ns)) {
                if (name !== 'default') set.add(name);
            }
        }
    }
    for (const name of _inlineKeys) set.add(name);
    // Barrel meta exports
    set.add('getExportNames');
    set.add('exportNames');
    set.add('getNamespaceNames');
    set.add('validateBarrelIntegrity');
    set.add('registerNamespaces');
    set.add('registerInlineKeys');
    set.add('setDefaultBarrel');
    set.add('__barrel__');
    return Object.freeze(Array.from(set).sort());
}

export function getExportNames() {
    if (!_cachedExportNames) {
        _cachedExportNames = _buildExportNames();
    }
    return _cachedExportNames;
}

/** Shorter alias for getExportNames. */
export const exportNames = getExportNames;

export function validateBarrelIntegrity(barrel = null) {
    const errors = [];
    const target = barrel || _defaultBarrel || (typeof __barrel__ !== 'undefined' ? __barrel__ : null);
    if (!target) {
        errors.push('Missing __barrel__ metadata');
    } else {
        const requiredMetaKeys = ['name', 'description', 'exportCount', 'version', 'timestamp', 'exports'];
        for (const metaKey of requiredMetaKeys) {
            if (!(metaKey in target)) {
                errors.push(`Missing __barrel__ key: "${metaKey}"`);
            }
        }
    }
    return { valid: errors.length === 0, errors };
}
