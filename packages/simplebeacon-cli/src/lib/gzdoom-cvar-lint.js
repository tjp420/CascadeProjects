/**
 * GZDoom CVAR cross-reference — CVARINFO vs MENUDEF vs ZScript FindCVar usage.
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('../rules/production-leak');

const CVAR_DEF_RE = /(?:^|\n)\s*(?:user|server|nosave)\s+(?:bool|int|float|string|color)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm;
// MENUDEF Option/Slider/Toggle entries reference CVARs.
// Command entries execute CCMDs (console commands/aliases defined in KEYCONF),
// NOT CVARs — excluding Command here prevents false "undefined CVAR" findings
// for console aliases like sky_day, music_fix, etc.
const MENU_CVAR_RE = /(?:Option|Slider|Toggle)\s+"[^"]*"\s*,\s*"([a-zA-Z_][a-zA-Z0-9_]*)"/g;
const ZSCRIPT_CVAR_RE = /(?:CVar\.)?FindCVar\s*\(\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*\)/g;
const ZSCRIPT_GETCVAR_RE = /GetCVar\s*\(\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*\)/g;

// GZDoom built-in engine CVARs that are always defined by the engine and
// should never be flagged as "undefined" just because they aren't in CVARINFO.
// These are commonly referenced by mods via GetCVar() or MENUDEF Option entries.
const ENGINE_CVAR_ALLOWLIST = new Set([
    // Core engine
    'sv_cheats', 'cl_run', 'screenblocks', 'snd_channels', 'developer',
    'mm_ai_level', 'mm_vfx_level',
    // Rendering
    'r_models', 'r_drawvoxels', 'r_dynamiclights', 'r_sprites', 'r_voxels',
    'r_3dmode', 'r_3dfloors', 'r_drawmirrors', 'r_drawfuzz', 'r_fog',
    'gl_lights', 'gl_fog', 'gl_fogmode', 'gl_blendmode', 'gl_light_models',
    'gl_light_sprites', 'gl_light_particles', 'gl_fuzzmode', 'gl_sprite_blend',
    'gl_usecolorbuffer', 'gl_attenuate', 'gl_exposure', 'gl_bloom',
    'gl_lens', 'gl_ssrquality', 'gl_fxaa', 'gl_ssao', 'gl_multisample',
    'vid_preferbackend', 'vid_rendermode', 'vid_fullscreen', 'vid_vsync',
    // Sound
    'snd_mastervolume', 'snd_musicvolume', 'snd_sfxvolume', 'snd_pitched',
    // Gameplay
    'sv_gravity', 'sv_aircontrol', 'sv_nojump', 'sv_nocrouch', 'sv_doubleammo',
    'sv_fastweapons', 'sv_infiniteammo', 'sv_itemrespawn', 'sv_noexit',
    // HUD
    'hud_scale', 'hud_size', 'hud_althud', 'screenblocks',
    // Compatibility
    'compat_oldrandom', 'compat_nopassover', 'compat_limitpain',
    'compat_novileghosts', 'compat_notossdrip', 'compat_noportal',
]);

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function parseCvarDefinitions(content, filePath) {
    const defs = [];
    let match;
    CVAR_DEF_RE.lastIndex = 0;
    while ((match = CVAR_DEF_RE.exec(content)) !== null) {
        defs.push({
            name: match[1],
            filePath,
            line: content.slice(0, match.index).split('\n').length
        });
    }
    return defs;
}

function parseMenuReferences(content, filePath) {
    const refs = [];
    // Only Option/Slider/Toggle reference CVARs — Command entries execute
    // CCMDs (console aliases), not CVARs, so they are excluded.
    MENU_CVAR_RE.lastIndex = 0;
    let match;
    while ((match = MENU_CVAR_RE.exec(content)) !== null) {
        refs.push({
            name: match[1],
            filePath,
            line: content.slice(0, match.index).split('\n').length,
            source: 'menuddef'
        });
    }
    return refs;
}

function parseZscriptReferences(content, filePath) {
    const refs = [];
    for (const re of [ZSCRIPT_CVAR_RE, ZSCRIPT_GETCVAR_RE]) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(content)) !== null) {
            refs.push({
                name: match[1],
                filePath,
                line: content.slice(0, match.index).split('\n').length,
                source: 'zscript'
            });
        }
    }
    return refs;
}

const LUMP_FILES = new Set(['cvarinfo', 'menudef', 'menudef_r3d', 'menudef.txt']);

function collectCvarLintFiles(root, ignoreGlobs = []) {
    /** @type {Array<{path:string,relativePath:string,name:string}>} */
    const files = [];
    function walk(dir, depth) {
        if (depth > 12) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            const rel = normalizeRel(root, full);
            if (ignoreGlobs.some((g) => globMatch(rel, g))) continue;
            if (entry.isDirectory()) {
                if (/node_modules|\.git$/i.test(entry.name)) continue;
                walk(full, depth + 1);
                continue;
            }
            if (!entry.isFile()) continue;
            const lower = entry.name.toLowerCase();
            const isLump = LUMP_FILES.has(lower) || lower.startsWith('menudef');
            const isZs = /\.(zs|zscript)$/i.test(lower);
            if (isLump || isZs) {
                files.push({ path: full, relativePath: rel, name: entry.name });
            }
        }
    }
    walk(path.resolve(root), 0);
    return files;
}

function isMenuDefFile(name, rel) {
    const lower = String(name || '').toLowerCase();
    const r = String(rel || '').toLowerCase();
    return lower.startsWith('menudef') || r.startsWith('menudef');
}

function isCvarInfoFile(name, rel) {
    const lower = String(name || '').toLowerCase();
    return lower === 'cvarinfo' || lower.endsWith('.cvarinfo');
}

function resolveCompanionPaths(modPath, options = {}) {
    const roots = [path.resolve(modPath)];
    const companions = options.companionModPaths || options.companionMods || [];
    for (const entry of companions) {
        if (!entry) continue;
        const resolved = path.isAbsolute(entry)
            ? entry
            : path.resolve(path.dirname(modPath), '..', entry);
        if (fs.existsSync(resolved)) roots.push(resolved);
    }
    if (options.companionMod) {
        const sibling = path.resolve(path.dirname(modPath), options.companionMod);
        if (fs.existsSync(sibling) && !roots.includes(sibling)) roots.push(sibling);
    }
    return [...new Set(roots)];
}

function readConfigGzdoom(modPath) {
    const cfgPath = path.join(modPath, '.simplebeacon', 'config.json');
    if (!fs.existsSync(cfgPath)) return {};
    try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        return cfg.gzdoom || {};
    } catch {
        return {};
    }
}

/**
 * @param {string} modPath
 * @param {{cvarPrefix?:string,cvarAllowlist?:string[],companionMod?:string,companionModPaths?:string[],ignoreGlobs?:string[],severity?:string,deadCvarSeverity?:string}} [options]
 */
async function lintGzdoomCvars(modPath, options = {}) {
    const gzdoomCfg = readConfigGzdoom(modPath);
    const opts = { ...gzdoomCfg, ...options };
    const prefix = opts.cvarPrefix || 'r3d_';
    const allowlist = new Set([...ENGINE_CVAR_ALLOWLIST, ...(opts.cvarAllowlist || [])]);
    const allowlistPrefixes = opts.cvarAllowlistPrefixes || [];
    const severity = opts.severity || 'high';
    const deadSeverity = opts.deadCvarSeverity || 'low';
    const ignoreGlobs = opts.ignoreGlobs || [];
    const roots = resolveCompanionPaths(modPath, opts);

    function isAllowlisted(name) {
        if (allowlist.has(name)) return true;
        for (const p of allowlistPrefixes) {
            if (name.startsWith(p)) return true;
        }
        return false;
    }

    /** @type {Map<string, {name:string,filePath:string,line:number}[]>} */
    const definitions = new Map();
    /** @type {Array<{name:string,filePath:string,line:number,source:string}>} */
    const references = [];

    for (const root of roots) {
        const files = collectCvarLintFiles(root, ignoreGlobs);
        for (const file of files) {
            let content;
            try {
                content = fs.readFileSync(file.path, 'utf8');
            } catch {
                continue;
            }
            const rel = file.relativePath;
            if (isCvarInfoFile(file.name, rel)) {
                for (const def of parseCvarDefinitions(content, rel)) {
                    if (!definitions.has(def.name)) definitions.set(def.name, []);
                    definitions.get(def.name).push(def);
                }
            }
            if (isMenuDefFile(file.name, rel)) {
                references.push(...parseMenuReferences(content, rel));
            }
            if (/\.(zs|zscript)$/i.test(rel)) {
                references.push(...parseZscriptReferences(content, rel));
            }
        }
    }

    const definedNames = new Set(definitions.keys());
    const referencedNames = new Set(references.map((r) => r.name));
    const issues = [];
    /** @type {Map<string, {name:string,source:string,severity:string,filePath:string,line:number,refs:typeof references}>} */
    const undefinedByName = new Map();

    for (const ref of references) {
        if (definedNames.has(ref.name) || isAllowlisted(ref.name)) continue;
        const isMenu = ref.source === 'menuddef';
        const isPrefixed = ref.name.startsWith(prefix);
        if (!isMenu && !isPrefixed) continue;
        const issueSeverity = isMenu ? severity : (opts.zscriptUndefinedSeverity || 'medium');
        const bucket = undefinedByName.get(ref.name);
        if (bucket) {
            bucket.refs.push(ref);
            if (issueSeverity === 'high' && bucket.severity !== 'high') bucket.severity = 'high';
            continue;
        }
        undefinedByName.set(ref.name, {
            name: ref.name,
            source: ref.source,
            severity: issueSeverity,
            filePath: ref.filePath,
            line: ref.line,
            refs: [ref]
        });
    }

    for (const entry of undefinedByName.values()) {
        const sources = [...new Set(entry.refs.map((r) => r.source))];
        issues.push({
            type: 'gzdoom-cvar-undefined',
            severity: entry.severity,
            filePath: entry.filePath,
            line: entry.line,
            count: entry.refs.length,
            description: `CVAR "${entry.name}" referenced in ${sources.join('/')} (${entry.refs.length} refs) but not defined in any scanned CVARINFO`,
            recommendedAction: `Add "${entry.name}" to CVARINFO or fix typo (expected prefix ${prefix})`,
            affectedFiles: [...new Set(entry.refs.map((r) => r.filePath))].slice(0, 20),
            metadata: { engine: 'gzdoom-cvar-lint', cvar: entry.name, sources }
        });
    }

    let deadCount = 0;
    for (const [name, defs] of definitions.entries()) {
        if (referencedNames.has(name) || isAllowlisted(name)) continue;
        if (!name.startsWith(prefix)) continue;
        if (deadCount >= 30) break;
        deadCount++;
        issues.push({
            type: 'gzdoom-cvar-dead',
            severity: deadSeverity,
            filePath: defs[0].filePath,
            line: defs[0].line,
            count: 1,
            description: `CVAR "${name}" is defined in CVARINFO but never referenced in MENUDEF or ZScript`,
            recommendedAction: 'Remove dead CVAR or wire it into menu/ZScript',
            affectedFiles: defs.map((d) => d.filePath),
            metadata: { engine: 'gzdoom-cvar-lint', cvar: name }
        });
    }

    for (const [name, defs] of definitions.entries()) {
        if (isAllowlisted(name)) continue;
        if (name.startsWith(prefix)) continue;
        if (/^(wraith_|mm_|hellfire_)/.test(name)) {
            issues.push({
                type: 'gzdoom-cvar-prefix',
                severity: 'medium',
                filePath: defs[0].filePath,
                line: defs[0].line,
                count: 1,
                description: `CVAR "${name}" does not use project prefix "${prefix}" — consider r3d_${name.replace(/^hellfire_/, 'hellfire_')}`,
                recommendedAction: `Rename to ${prefix}${name.replace(/^r3d_/, '')} for consistency`,
                affectedFiles: defs.map((d) => d.filePath),
                metadata: { engine: 'gzdoom-cvar-lint', cvar: name, expectedPrefix: prefix }
            });
        }
    }

    return {
        scannedRoots: roots,
        definitions: definitions.size,
        references: references.length,
        findings: issues.length,
        issues
    };
}

module.exports = {
    lintGzdoomCvars,
    parseCvarDefinitions,
    parseMenuReferences,
    parseZscriptReferences,
    resolveCompanionPaths
};
