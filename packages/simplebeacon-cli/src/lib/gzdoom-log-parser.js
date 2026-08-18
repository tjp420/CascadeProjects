/**
 * Parse GZDoom runtime log lines into structured findings for correlation.
 */

const LOG_PATTERNS = Object.freeze([
    {
        id: 'GZ-LOG-001',
        kind: 'unknown-sprite',
        regex: /Unknown sprite (\S+) in model definition for (\S+)/i,
        severity: 'high',
        map: (m) => ({ sprite: m[1], modelName: m[2] })
    },
    {
        id: 'GZ-LOG-002',
        kind: 'unknown-class',
        regex: /Unknown class name '([^']+)' of type 'Actor'/i,
        severity: 'high',
        map: (m) => ({ className: m[1] })
    },
    {
        id: 'GZ-LOG-003',
        kind: 'duplicate-class',
        regex: /Tried to define class '([^']+)' more than once/i,
        severity: 'high',
        map: (m) => ({ className: m[1] })
    },
    {
        id: 'GZ-LOG-004',
        kind: 'replaces-conflict',
        regex: /(?:Can't|Cannot) replace actor '([^']+)'/i,
        severity: 'high',
        map: (m) => ({ replacedClass: m[1] })
    },
    {
        id: 'GZ-LOG-005',
        kind: 'script-error',
        regex: /Script error,\s*"([^"]+)"\s+line\s+(\d+):\s*(.*)/i,
        severity: 'high',
        map: (m) => ({ filePath: m[1], line: Number(m[2]), message: (m[3] || '').trim() })
    },
    {
        id: 'GZ-LOG-006',
        kind: 'missing-string',
        regex: /Missing string \(unexpected end of file\)/i,
        severity: 'high',
        map: () => ({ message: 'Missing string (unexpected end of file)' })
    },
    {
        id: 'GZ-LOG-007',
        kind: 'parse-error',
        regex: /Parse error(?: in)?(?: file)?(?: "([^"]+)")?(?:,)? line (\d+):\s*(.+)/i,
        severity: 'high',
        map: (m) => ({
            filePath: m[1] || null,
            line: Number(m[2]),
            message: (m[3] || '').trim()
        })
    },
    {
        id: 'GZ-LOG-008',
        kind: 'cvar-mismatch',
        regex: /Engine CVARs don't match!/i,
        severity: 'high',
        map: () => ({ message: 'Engine CVARs do not match expected render profile' })
    },
    {
        id: 'GZ-LOG-009',
        kind: 'cvar-render-conflict',
        regex: /3D model variants require r_drawvoxels 0 \(currently (\d+)\)/i,
        severity: 'high',
        map: (m) => ({ cvar: 'r_drawvoxels', current: Number(m[1]), expected: 0 })
    },
    {
        id: 'GZ-LOG-010',
        kind: 'cvar-render-conflict',
        regex: /3D model mode needs r_models=1, r_drawvoxels=0/i,
        severity: 'high',
        map: () => ({ cvar: 'r_models/r_drawvoxels', expected: 'r_models=1, r_drawvoxels=0' })
    },
    {
        id: 'GZ-LOG-011',
        kind: 'light-capacity',
        regex: /Dynamic light spawn skipped for (\S+) - invalid target or capacity reached \(active=(\d+) max=(\d+) total=(\d+)\)/i,
        severity: 'high',
        map: (m) => ({
            target: m[1],
            active: Number(m[2]),
            max: Number(m[3]),
            total: Number(m[4])
        })
    },
    {
        id: 'GZ-LOG-012',
        kind: 'manager-missing',
        regex: />>\s*([^:]+):\s*Not Found/i,
        severity: 'medium',
        map: (m) => ({ manager: m[1].trim() })
    },
    {
        id: 'GZ-LOG-013',
        kind: 'render-mode-split',
        regex: /Map items render requested:\s*(\S+).*r_models=(\d+).*r_drawvoxels=(\d+)/i,
        severity: 'medium',
        map: (m) => ({
            mode: m[1],
            r_models: Number(m[2]),
            r_drawvoxels: Number(m[3])
        })
    },
    {
        id: 'GZ-LOG-014',
        kind: 'cvar-protected',
        regex: /engine CVARs are protected; open the R3D Render menu/i,
        severity: 'medium',
        map: () => ({ message: 'Engine CVAR changes blocked — menu-only apply path' })
    }
]);

/**
 * @param {string} content Raw log file text.
 * @returns {Array<{id:string,kind:string,severity:string,line:number,text:string,details:Object}>}
 */
function parseGzdoomLog(content) {
    const entries = [];
    if (typeof content !== 'string' || !content.trim()) return entries;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i];
        for (const pattern of LOG_PATTERNS) {
            const match = pattern.regex.exec(text);
            if (!match) continue;
            entries.push({
                id: pattern.id,
                kind: pattern.kind,
                severity: pattern.severity,
                line: i + 1,
                text: text.trim(),
                details: pattern.map(match)
            });
            break;
        }
    }
    return entries;
}

module.exports = {
    LOG_PATTERNS,
    parseGzdoomLog
};
