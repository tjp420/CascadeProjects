/**
 * Parse GZDoom CVARINFO definitions and map FindCVar usage in ZScript sources.
 */

const fs = require('fs');
const path = require('path');

const CVARINFO_NAMES = ['CVARINFO', 'cvarinfo'];

function parseCvarInfoFile(content, sourceFile = 'CVARINFO') {
    const definitions = [];
    const lineRe = /^\s*(user|server|nosave|archive|latched|cheat)?\s*(bool|int|float|color|string)\s+([a-zA-Z0-9_]+)\s*=\s*([^;]+);/gim;

    for (const line of String(content || '').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;

        let match;
        const singleLine = line;
        lineRe.lastIndex = 0;
        while ((match = lineRe.exec(singleLine)) !== null) {
            const flags = match[1] || 'user';
            const type = match[2].toLowerCase();
            const name = match[3];
            const defaultRaw = match[4].trim();
            definitions.push({
                name,
                type,
                flags,
                defaultValue: parseDefaultValue(type, defaultRaw),
                defaultRaw,
                sourceFile,
                comment: extractTrailingComment(line)
            });
        }
    }

    return definitions;
}

function parseDefaultValue(type, raw) {
    const value = String(raw || '').trim();
    if (type === 'bool') return /^true$/i.test(value);
    if (type === 'int') return parseInt(value, 10);
    if (type === 'float') return parseFloat(value);
    return value.replace(/^["']|["']$/g, '');
}

function extractTrailingComment(line) {
    const idx = String(line).indexOf('//');
    return idx >= 0 ? line.slice(idx + 2).trim() : '';
}

async function findCvarInfoFiles(rootDir) {
    const results = [];
    async function walk(dir, depth = 0) {
        if (depth > 12) return;
        let entries;
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (['node_modules', '.git'].includes(entry.name)) continue;
                await walk(full, depth + 1);
                continue;
            }
            if (CVARINFO_NAMES.includes(entry.name.toLowerCase())) {
                results.push(full);
            }
        }
    }
    await walk(path.resolve(rootDir));
    return results;
}

function extractFindCvarUsages(content, relativePath) {
    const usages = [];
    const re = /CVar\.FindCVar\s*\(\s*["']([a-zA-Z0-9_]+)["']\s*\)/g;
    let match;
    while ((match = re.exec(content)) !== null) {
        usages.push({
            cvarName: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }
    return usages;
}

function extractIntensityScalingHints(content, relativePath) {
    const hints = [];
    const patterns = [
        { id: 'find-cvar-intensity', re: /FindCVar\s*\(\s*["'][^"']*intensity[^"']*["']\s*\)/gi, label: 'CVAR intensity lookup' },
        { id: 'master-intensity-var', re: /\bmasterIntensity\b/g, label: 'masterIntensity field usage' },
        { id: 'adjust-brightness', re: /\bAdjustBrightness\s*\(/g, label: 'AdjustBrightness call' },
        { id: 'calculate-light-intensity', re: /\bCalculateLightIntensity\s*\(/g, label: 'CalculateLightIntensity call' },
        { id: 'clamp-intensity', re: /\bclamp\s*\([^)]*intensity[^)]*\)/gi, label: 'Intensity clamp' },
        { id: 'multiply-intensity', re: /intensity\s*\*\s*[a-zA-Z_]/gi, label: 'Intensity multiplication' }
    ];

    for (const item of patterns) {
        const matches = content.match(item.re);
        if (!matches?.length) continue;
        hints.push({
            id: item.id,
            label: item.label,
            filePath: relativePath,
            matchCount: matches.length
        });
    }
    return hints;
}

function lineNumberAt(content, index) {
    return content.slice(0, Math.max(0, index)).split('\n').length;
}

function inferApplicationLogic(def, usages) {
    const name = def.name.toLowerCase();
    if (name.includes('intensity')) {
        return 'Controls light brightness scaling — verify GetFloat() result is applied to rendered light output.';
    }
    if (name.includes('enabled')) {
        return 'Master toggle — when false, downstream lighting code should early-return.';
    }
    if (name.includes('max_lights')) {
        return 'Caps concurrent dynamic lights — affects spawn/retention logic.';
    }
    if (usages.length) {
        return `Read at runtime via FindCVar in ${usages.length} location(s).`;
    }
    return 'Defined in CVARINFO but no FindCVar reference found in scanned ZScript.';
}

async function buildCvarReport(rootDir, zscriptFiles, _options = {}) {
    const cvarInfoPaths = await findCvarInfoFiles(rootDir);
        const definitions = [];
        for (const filePath of cvarInfoPaths) {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
            definitions.push(...parseCvarInfoFile(content, rel));
        }

        const usageIndex = new Map();
        const scalingHints = [];
        for (const file of zscriptFiles) {
            for (const usage of extractFindCvarUsages(file.content, file.relativePath)) {
                if (!usageIndex.has(usage.cvarName)) usageIndex.set(usage.cvarName, []);
                usageIndex.get(usage.cvarName).push(usage);
            }
            scalingHints.push(...extractIntensityScalingHints(file.content, file.relativePath));
        }

        const cvars = {};
        for (const def of definitions) {
            const usedIn = (usageIndex.get(def.name) || []).map((u) => ({
                filePath: u.filePath,
                line: u.line
            }));
            cvars[def.name] = {
                ...def,
                usedIn,
                applicationLogic: inferApplicationLogic(def, usedIn)
            };
        }

        // Orphan FindCVar names not in CVARINFO
        const orphanUsages = [];
        for (const [name, refs] of usageIndex.entries()) {
            if (!cvars[name]) {
                orphanUsages.push({ name, references: refs });
            }
        }

        const intensityCvars = Object.values(cvars).filter((c) => /intensity/i.test(c.name));
        const problemHints = buildIntensityProblemHints(intensityCvars, scalingHints);

    return {
        cvarInfoFiles: cvarInfoPaths.map((p) => path.relative(rootDir, p).replace(/\\/g, '/')),
        cvars,
        intensityCvars: intensityCvars.map((c) => c.name),
        orphanFindCvarReferences: orphanUsages,
        scalingHints: scalingHints.slice(0, 80),
        problemHints
    };
}

function buildIntensityProblemHints(intensityCvars, scalingHints) {
    const hints = [];
    if (intensityCvars.length > 1) {
        hints.push({
            severity: 'medium',
            type: 'multiple-intensity-cvars',
            message: `${intensityCvars.length} intensity-related CVARs found — confirm gameplay tuning uses the intended CVAR (global vs player/item multipliers).`,
            cvars: intensityCvars.map((c) => ({
                name: c.name,
                defaultValue: c.defaultValue,
                usedInFiles: c.usedIn?.length || 0
            }))
        });
    }

    const globalDef = intensityCvars.find((c) => c.name.includes('lite_intensity') && !c.name.includes('player') && !c.name.includes('item'));
    const playerDef = intensityCvars.find((c) => c.name.includes('player_intensity'));

    if (globalDef && playerDef) {
        hints.push({
            severity: 'high',
            type: 'scale-mismatch-risk',
            message: 'Global intensity uses large float range (e.g. 750) while player intensity uses small multiplier (e.g. 1.0) — changing one may not affect visuals if code path reads the other.',
            globalCvar: globalDef.name,
            multiplierCvar: playerDef.name
        });
    }

    if (!scalingHints.some((h) => h.id === 'multiply-intensity' || h.id === 'adjust-brightness')) {
        hints.push({
            severity: 'medium',
            type: 'missing-scaling-chain',
            message: 'No obvious intensity multiplication/AdjustBrightness chain detected in scanned files — CVAR value may be read but not applied to rendered light.'
        });
    }

    return hints;
}

module.exports = {
    parseCvarInfoFile,
    findCvarInfoFiles,
    extractFindCvarUsages,
    buildCvarReport
};
