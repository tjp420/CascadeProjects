/**
 * Pluggable runtime log parsers — GZDoom, Unity Player.log, Godot stderr.
 */

const { parseGzdoomLog } = require('./gzdoom-log-parser');

const UNITY_PATTERNS = Object.freeze([
    {
        id: 'UNI-LOG-001',
        kind: 'missing-script',
        regex: /The referenced script \(([^)]+)\) on this Behaviour is missing!/i,
        severity: 'high',
        map: (m) => ({ scriptName: m[1] })
    },
    {
        id: 'UNI-LOG-002',
        kind: 'compile-error',
        regex: /error CS(\d+):\s*(.+?) in (.+?):(\d+)/i,
        severity: 'high',
        map: (m) => ({ code: m[1], message: m[2].trim(), filePath: m[3], line: Number(m[4]) })
    },
    {
        id: 'UNI-LOG-003',
        kind: 'missing-asset',
        regex: /Could not load (?:the )?(?:file|asset) '([^']+)'/i,
        severity: 'high',
        map: (m) => ({ assetPath: m[1] })
    },
    {
        id: 'UNI-LOG-004',
        kind: 'shader-error',
        regex: /Shader error in '([^']+)':(.+)/i,
        severity: 'medium',
        map: (m) => ({ shader: m[1], message: m[2].trim() })
    }
]);

const GODOT_PATTERNS = Object.freeze([
    {
        id: 'GOD-LOG-001',
        kind: 'parse-error',
        regex: /SCRIPT ERROR: Parse Error:\s*(.+?) at:\s*(.+?):(\d+)/i,
        severity: 'high',
        map: (m) => ({ message: m[1].trim(), filePath: m[2], line: Number(m[3]) })
    },
    {
        id: 'GOD-LOG-002',
        kind: 'load-error',
        regex: /ERROR: Cannot open file '([^']+)'/i,
        severity: 'high',
        map: (m) => ({ filePath: m[1] })
    },
    {
        id: 'GOD-LOG-003',
        kind: 'missing-resource',
        regex: /ERROR: Resource file not found:\s*(.+?)(?:\s|$)/i,
        severity: 'high',
        map: (m) => ({ resourcePath: m[1].trim() })
    },
    {
        id: 'GOD-LOG-004',
        kind: 'invalid-node',
        regex: /ERROR: Node not found:\s*(.+?)(?:\s|$)/i,
        severity: 'high',
        map: (m) => ({ nodePath: m[1].trim() })
    }
]);

function parseWithPatterns(content, patterns, engine) {
    const entries = [];
    if (typeof content !== 'string' || !content.trim()) return entries;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i];
        for (const pattern of patterns) {
            const match = pattern.regex.exec(text);
            if (!match) continue;
            entries.push({
                id: pattern.id,
                kind: pattern.kind,
                severity: pattern.severity,
                engine,
                line: i + 1,
                text: text.trim(),
                details: pattern.map(match)
            });
            break;
        }
    }
    return entries;
}

function parseUnityLog(content) {
    return parseWithPatterns(content, UNITY_PATTERNS, 'unity');
}

function parseGodotLog(content) {
    return parseWithPatterns(content, GODOT_PATTERNS, 'godot');
}

function detectLogEngine(content) {
    if (typeof content !== 'string') return 'generic';
    if (/Unknown sprite|Unknown class name|Script error,|\[R3D\]|GZDoom version|WEAPON_SWITCHER|VMS_MANAGER/i.test(content)) return 'gzdoom';
    if (/UnityEngine|Player\.log|error CS\d+:/i.test(content)) return 'unity';
    if (/SCRIPT ERROR:|Godot Engine|ERROR: Cannot open file/i.test(content)) return 'godot';
    return 'generic';
}

/**
 * Parse a runtime log with auto engine detection or explicit engine hint.
 * @param {string} content
 * @param {{engine?:string}} [options]
 * @returns {Array<Object>}
 */
function parseGameLog(content, options = {}) {
    const hint = String(options.engine || 'auto').toLowerCase();
    const engine = hint === 'auto' ? detectLogEngine(content) : hint;
    if (engine === 'gzdoom') {
        return parseGzdoomLog(content).map((entry) => ({ ...entry, engine: 'gzdoom' }));
    }
    if (engine === 'unity') return parseUnityLog(content);
    if (engine === 'godot') return parseGodotLog(content);
    return [
        ...parseUnityLog(content),
        ...parseGodotLog(content),
        ...parseGzdoomLog(content).map((entry) => ({ ...entry, engine: 'gzdoom' }))
    ];
}

module.exports = {
    parseGameLog,
    parseUnityLog,
    parseGodotLog,
    detectLogEngine,
    UNITY_PATTERNS,
    GODOT_PATTERNS
};
