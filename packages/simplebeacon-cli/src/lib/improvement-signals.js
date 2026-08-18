/**
 * Improvement signals — aggregates repeated failure patterns and suggests actions.
 * Writes to .simplebeacon/improvement-signals.json.
 *
 * A signal is created when the same failure pattern (category + errorType) appears
 * multiple times. Each signal has a suggested action and priority.
 */

const fs = require('fs');
const path = require('path');
const { getFailureSummary } = require('./failure-log');

const MAX_SIGNALS = 50;
const SIGNALS_FILENAME = 'improvement-signals.json';

// Threshold: if a pattern appears this many times, it becomes a signal
const SIGNAL_THRESHOLD = 2;

// Suggested actions by category + errorType
const ACTION_LIBRARY = {
    'compile|syntax_error': {
        action: 'Tighten class definition validation and require a compile pass between AI edits.',
        priority: 'high'
    },
    'compile|undefined_symbol': {
        action: 'Add symbol graph validation before accepting AI-generated code. Check that all referenced actors/classes exist.',
        priority: 'high'
    },
    'runtime|missing_asset': {
        action: 'Add asset existence checks before final build and before AI continues. Validate all texture/sprite/sound references.',
        priority: 'high'
    },
    'runtime|acs_error': {
        action: 'Run ACS compile check before claiming mod is done. Check for missing scripts and library references.',
        priority: 'high'
    },
    'scan|placeholder_value': {
        action: 'Block placeholder strings and force the model to replace them with real data or approved-tagged placeholders.',
        priority: 'medium'
    },
    'scan|fiction_kpi': {
        action: 'Block fictional KPIs and metrics. Require real data sources or explicit TODO tags.',
        priority: 'medium'
    },
    'scan|llm_slop': {
        action: 'Enable LLM slop scanner in verify_before_write. Block markdown fences and LLM preambles in source files.',
        priority: 'medium'
    },
    'scan|phantom_api': {
        action: 'Enable phantom API scanner in verify_before_write. Block hallucinated method calls on real libraries.',
        priority: 'high'
    },
    'scan|swallowed_exception': {
        action: 'Enable swallowed exception scanner in verify_before_write. Block empty catch blocks and silent error returns.',
        priority: 'high'
    },
    'scan|hallucinated_import': {
        action: 'Enable hallucinated import scanner in verify_before_write. Block imports that do not exist.',
        priority: 'high'
    },
    'gate|blocking_issue': {
        action: 'Fix gate-blocking issues before continuing AI generation. Do not build on top of a failing gate.',
        priority: 'high'
    },
    'smoke_test|crash': {
        action: 'Fix runtime crash before continuing. Run smoke test after every significant AI edit.',
        priority: 'critical'
    },
    'smoke_test|missing_asset': {
        action: 'Fix missing asset references before continuing. Validate asset contract before write.',
        priority: 'high'
    }
};

/**
 * Build a signal key from category and errorType.
 * @param {string} category
 * @param {string} errorType
 * @returns {string}
 */
function buildSignalKey(category, errorType) {
    return `${category}|${errorType || 'unknown'}`;
}

/**
 * Get the suggested action for a failure pattern.
 * @param {string} category
 * @param {string} errorType
 * @returns {{ action: string, priority: string } | null}
 */
function getSuggestedAction(category, errorType) {
    const key = buildSignalKey(category, errorType);
    if (ACTION_LIBRARY[key]) return ACTION_LIBRARY[key];

    // Fallback by category only
    for (const [actionKey, action] of Object.entries(ACTION_LIBRARY)) {
        if (actionKey.startsWith(`${category}|`)) {
            return action;
        }
    }

    // Generic fallback
    return {
        action: `Review repeated ${category} failures and add a validation check for this pattern.`,
        priority: 'medium'
    };
}

/**
 * Read signals from disk.
 * @param {string} projectRoot
 * @returns {Array}
 */
function readSignals(projectRoot) {
    const signalsPath = path.join(projectRoot, '.simplebeacon', SIGNALS_FILENAME);
    try {
        const data = JSON.parse(fs.readFileSync(signalsPath, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

/**
 * Write signals to disk.
 * @param {string} projectRoot
 * @param {Array} signals
 */
function writeSignals(projectRoot, signals) {
    const signalsPath = path.join(projectRoot, '.simplebeacon', SIGNALS_FILENAME);
    fs.mkdirSync(path.dirname(signalsPath), { recursive: true });
    fs.writeFileSync(signalsPath, `${JSON.stringify(signals, null, 2)}\n`, 'utf8');
}

/**
 * Rebuild signals from the failure log.
 * Called after failures are appended to refresh the signal aggregation.
 * @param {string} projectRoot
 * @param {object} [options] - { dryRun: boolean }
 * @returns {{ signals: Array, updated: number }}
 */
function rebuildSignals(projectRoot, options = {}) {
    const summary = getFailureSummary(projectRoot);
    const existingSignals = readSignals(projectRoot);
    const existingMap = {};
    for (const sig of existingSignals) {
        existingMap[sig.patternKey] = sig;
    }

    const newSignals = [];
    let updated = 0;

    for (const group of summary) {
        if (group.count < SIGNAL_THRESHOLD) continue;

        const patternKey = buildSignalKey(group.category, group.errorType);
        const suggested = getSuggestedAction(group.category, group.errorType);
        const existing = existingMap[patternKey];

        if (existing) {
            // Update existing signal
            existing.occurrenceCount = group.count;
            existing.lastSeen = group.lastSeen;
            existing.files = group.files;
            existing.sampleMessage = group.sampleMessage;
            // Don't downgrade priority
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            if (priorityOrder[suggested.priority] < priorityOrder[existing.priority]) {
                existing.priority = suggested.priority;
                existing.suggestedAction = suggested.action;
            }
            newSignals.push(existing);
            delete existingMap[patternKey];
            updated++;
        } else {
            // Create new signal
            newSignals.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                patternKey,
                category: group.category,
                errorType: group.errorType,
                occurrenceCount: group.count,
                lastSeen: group.lastSeen,
                files: group.files,
                sampleMessage: group.sampleMessage,
                suggestedAction: suggested.action,
                priority: suggested.priority,
                resolved: false,
                createdAt: new Date().toISOString()
            });
            updated++;
        }
    }

    // Keep resolved signals for history but cap total
    for (const sig of Object.values(existingMap)) {
        if (sig.resolved) {
            newSignals.push(sig);
        }
    }

    // Sort: unresolved first, then by priority, then by occurrence count
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    newSignals.sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return b.occurrenceCount - a.occurrenceCount;
    });

    const capped = newSignals.slice(0, MAX_SIGNALS);

    if (!options.dryRun) {
        writeSignals(projectRoot, capped);
    }

    return { signals: capped, updated };
}

/**
 * Mark a signal as resolved.
 * @param {string} projectRoot
 * @param {string} signalId
 * @param {string} [resolution]
 * @returns {{ signals: Array, resolved: boolean }}
 */
function resolveSignal(projectRoot, signalId, resolution) {
    const signals = readSignals(projectRoot);
    let resolved = false;

    for (const sig of signals) {
        if (sig.id === signalId) {
            sig.resolved = true;
            sig.resolution = resolution || sig.resolution;
            sig.resolvedAt = new Date().toISOString();
            resolved = true;
            break;
        }
    }

    if (resolved) {
        writeSignals(projectRoot, signals);
    }

    return { signals, resolved };
}

/**
 * Get unresolved signals sorted by priority.
 * @param {string} projectRoot
 * @returns {Array}
 */
function getActiveSignals(projectRoot) {
    return readSignals(projectRoot)
        .filter((s) => !s.resolved)
        .sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (pDiff !== 0) return pDiff;
            return b.occurrenceCount - a.occurrenceCount;
        });
}

module.exports = {
    buildSignalKey,
    getSuggestedAction,
    readSignals,
    rebuildSignals,
    resolveSignal,
    getActiveSignals,
    ACTION_LIBRARY,
    SIGNAL_THRESHOLD
};
