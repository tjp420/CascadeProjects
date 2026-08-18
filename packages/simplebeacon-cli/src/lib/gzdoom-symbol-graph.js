/**
 * Build a GZDoom mod symbol graph from DECORATE, ZScript, MODELDEF, KEYCONF, MAPINFO, and sprites.
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('../rules/production-leak');
const { isVanillaActor, isIntentionalInventoryFunction } = require('./gzdoom-vanilla-actors');
const { resolveReachableGzdoomFiles, LUMP_ENTRIES } = require('./gzdoom-include-resolver');

const GZDoom_FILE_NAMES = new Set([
    'modeldef', 'voxeldef', 'decorate', 'zscript', 'keyconf', 'mapinfo', 'cvarinfo', 'texturedef', 'animdefs'
]);
const GZDoom_EXTENSIONS = new Set(['.zs', '.zscript', '.decorate', '.dec', '.def']);
const MAX_SCAN_BYTES = 1024 * 1024;
const DEFAULT_SKIP_DIRS = new Set([
    'node_modules', '.git', 'coverage', 'dist', 'build', '.simplebeacon', 'github-cache', 'archive'
]);

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function lineNumberAt(content, index) {
    return content.slice(0, Math.max(0, index)).split('\n').length;
}

function isGzdoomSourceFile(relativePath, fileName) {
    const lower = String(fileName || '').toLowerCase();
    if (GZDoom_FILE_NAMES.has(lower)) return true;
    const ext = path.extname(lower);
    return GZDoom_EXTENSIONS.has(ext);
}

function isSpriteAsset(relativePath) {
    const rel = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    if (!/\.(png|jpg|jpeg|webp)$/i.test(rel)) return false;
    return rel.includes('/sprites/') || rel.startsWith('sprites/');
}

function getFunctionNameAtLine(content, lineNum) {
    const lines = String(content || '').split('\n');
    const fnRe = /^\s*(?:override\s+)?(?:static\s+)?(?:void|bool|int|float|double|string|state|action)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
    for (let i = Math.min(lineNum - 1, lines.length - 1); i >= 0; i--) {
        const match = fnRe.exec(lines[i]);
        if (match) return match[1];
        if (/^\s*class\s+/.test(lines[i])) break;
    }
    return null;
}

function isAlwaysReachableSource(relativePath, fileName) {
    const lower = String(fileName || '').toLowerCase();
    const rel = String(relativePath || '').toLowerCase();
    if (LUMP_ENTRIES.has(lower)) return true;
    return rel.endsWith('.decorate') || rel.endsWith('.dec');
}

function spriteNameFromAsset(relativePath) {
    const base = path.basename(relativePath, path.extname(relativePath));
    return base.toUpperCase();
}

/**
 * @param {string} baseDir
 * @param {{ignoreGlobs?:string[],maxDepth?:number}} [options]
 * @returns {Promise<Array<{path:string,relativePath:string,name:string,kind:string}>>}
 */
async function collectGzdoomFiles(baseDir, options = {}) {
    const ignoreGlobs = options.ignoreGlobs || [];
    const maxDepth = options.maxDepth ?? 12;
    const files = [];

    async function walk(dir, depth) {
        if (depth > maxDepth) return;
        let entries;
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            const rel = normalizeRel(baseDir, full);
            if (entry.isDirectory()) {
                if (DEFAULT_SKIP_DIRS.has(entry.name)) continue;
                if (ignoreGlobs.some((g) => globMatch(rel, g))) continue;
                await walk(full, depth + 1);
                continue;
            }
            if (!entry.isFile()) continue;
            if (ignoreGlobs.some((g) => globMatch(rel, g))) continue;
            let kind = null;
            if (isGzdoomSourceFile(rel, entry.name)) kind = 'source';
            else if (isSpriteAsset(rel)) kind = 'sprite';
            if (!kind) continue;
            try {
                const stat = await fs.promises.stat(full);
                if (stat.size > MAX_SCAN_BYTES) continue;
                files.push({ path: full, relativePath: rel, name: entry.name, kind });
            } catch {
                /* skip */
            }
        }
    }

    await walk(path.resolve(baseDir), 0);
    return files;
}

/**
 * @param {string} content
 * @param {string} relativePath
 * @param {Object} graph
 */
function ingestDecorate(content, relativePath, graph) {
    const actorRe = /^\s*Actor\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([A-Za-z_][A-Za-z0-9_]*))?\s*/gim;
    let match;
    while ((match = actorRe.exec(content)) !== null) {
        registerActor(graph, match[1], relativePath, lineNumberAt(content, match.index), 'decorate');
    }

    const replacesRe = /^\s*(?:ACTOR\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+replaces\s+([A-Za-z_][A-Za-z0-9_]*)\b/gim;
    while ((match = replacesRe.exec(content)) !== null) {
        registerActor(graph, match[1], relativePath, lineNumberAt(content, match.index), 'decorate');
        registerReplaces(graph, match[1], match[2], relativePath, lineNumberAt(content, match.index));
    }

    const projectileRe = /A_FireProjectile\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"/gi;
    while ((match = projectileRe.exec(content)) !== null) {
        graph.projectileRefs.push({
            className: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }

    const takeRe = /A_TakeInventory\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"/gi;
    while ((match = takeRe.exec(content)) !== null) {
        graph.inventoryOps.push({
            op: 'take',
            item: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }

    const giveRe = /A_GiveInventory\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"/gi;
    while ((match = giveRe.exec(content)) !== null) {
        graph.inventoryOps.push({
            op: 'give',
            item: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }

    const removeWeaponRe = /A_RemoveWeaponType\s*\(\s*(WEAPON_[A-Z0-9_]+)\s*\)/gi;
    while ((match = removeWeaponRe.exec(content)) !== null) {
        graph.inventoryOps.push({
            op: 'removeWeapon',
            item: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }

    ingestDecorateStateBlocks(content, relativePath, graph);
}

function ingestDecorateStateBlocks(content, relativePath, graph) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const takeMatch = /A_TakeInventory\s*\(\s*"([^"]+)"/.exec(lines[i]);
        if (!takeMatch) continue;
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
            if (/A_FireProjectile\s*\([^)]*,\s*true\s*\)/.test(lines[j])) {
                graph.doubleAmmoStates.push({
                    ammoType: takeMatch[1],
                    filePath: relativePath,
                    line: i + 1,
                    snippet: lines[i].trim()
                });
                break;
            }
        }
    }
}

/**
 * @param {string} content
 * @param {string} relativePath
 * @param {Object} graph
 */
function ingestZScript(content, relativePath, graph) {
    const classRe = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([A-Za-z_][A-Za-z0-9_.]*))?\s*\{/g;
    let match;
    while ((match = classRe.exec(content)) !== null) {
        registerActor(graph, match[1], relativePath, lineNumberAt(content, match.index), 'zscript');
    }

    const projectileRe = /A_FireProjectile\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"/gi;
    while ((match = projectileRe.exec(content)) !== null) {
        graph.projectileRefs.push({
            className: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }

    const takeRe = /(?:TakeInventory|A_TakeInventory)\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"/gi;
    while ((match = takeRe.exec(content)) !== null) {
        const line = lineNumberAt(content, match.index);
        graph.inventoryOps.push({
            op: 'take',
            item: match[1],
            filePath: relativePath,
            line,
            functionName: getFunctionNameAtLine(content, line)
        });
    }

    const giveRe = /(?:GiveInventory|A_GiveInventory)\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"/gi;
    while ((match = giveRe.exec(content)) !== null) {
        const line = lineNumberAt(content, match.index);
        graph.inventoryOps.push({
            op: 'give',
            item: match[1],
            filePath: relativePath,
            line,
            functionName: getFunctionNameAtLine(content, line)
        });
    }

    // ZScript double-ammo detection: A_TakeInventory + A_FireProjectile(..., true, ...)
    ingestZScriptStateBlocks(content, relativePath, graph);
}

/**
 * Detect double-ammo consumption in ZScript method bodies.
 * Mirrors ingestDecorateStateBlocks but for ZScript syntax.
 */
function ingestZScriptStateBlocks(content, relativePath, graph) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const takeMatch = /(?:A_TakeInventory|TakeInventory)\s*\(\s*"([^"]+)"/.exec(lines[i]);
        if (!takeMatch) continue;
        // Look ahead up to 8 lines for A_FireProjectile with useammo=true
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
            // ZScript A_FireProjectile signature: (name, angle, useammo, ...)
            // Check for true in the 3rd argument position
            const fireMatch = /A_FireProjectile\s*\(\s*"[^"]+"\s*,\s*[^,]+,\s*true/.test(lines[j]);
            if (fireMatch) {
                graph.doubleAmmoStates.push({
                    ammoType: takeMatch[1],
                    filePath: relativePath,
                    line: i + 1,
                    snippet: lines[i].trim()
                });
                break;
            }
            // Also check for A_FireProjectile with useammo=true as a named arg
            const fireMatch2 = /A_FireProjectile\s*\([^)]*useammo\s*=\s*true/.test(lines[j]);
            if (fireMatch2) {
                graph.doubleAmmoStates.push({
                    ammoType: takeMatch[1],
                    filePath: relativePath,
                    line: i + 1,
                    snippet: lines[i].trim()
                });
                break;
            }
        }
    }
}

function ingestModelDef(content, relativePath, graph) {
    const modelRe = /^\s*Model\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gim;
    let match;
    while ((match = modelRe.exec(content)) !== null) {
        graph.modelActorRefs.push({
            actor: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }

    const frameRe = /FrameIndex\s+SPRITE\s+([A-Za-z0-9_]+)/gi;
    while ((match = frameRe.exec(content)) !== null) {
        graph.modelSpriteRefs.push({
            sprite: match[1].toUpperCase(),
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }
}

function ingestKeyConf(content, relativePath, graph) {
    const slotRe = /WeaponSlot\s+\d+\s*,\s*([A-Za-z_][A-Za-z0-9_]*)/gi;
    let match;
    while ((match = slotRe.exec(content)) !== null) {
        graph.weaponSlotRefs.push({
            className: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }
}

function ingestMapInfo(content, relativePath, graph) {
    const startItemRe = /(?:StartItem|WeaponStartItem)\s*=\s*"([A-Za-z_][A-Za-z0-9_]*)"/gi;
    let match;
    while ((match = startItemRe.exec(content)) !== null) {
        graph.startItemRefs.push({
            className: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }

    const playerWeaponRe = /Player\.(?:StartItem|WeaponSlot)[^"\n]*"([A-Za-z_][A-Za-z0-9_]*)"/gi;
    while ((match = playerWeaponRe.exec(content)) !== null) {
        graph.startItemRefs.push({
            className: match[1],
            filePath: relativePath,
            line: lineNumberAt(content, match.index)
        });
    }
}

function registerActor(graph, name, filePath, line, sourceKind) {
    const key = name;
    if (!graph.actors.has(key)) {
        graph.actors.set(key, []);
    }
    graph.actors.get(key).push({ name: key, filePath, line, sourceKind });
}

function registerReplaces(graph, className, replacedClass, filePath, line) {
    if (!graph.replacesChains.has(replacedClass)) {
        graph.replacesChains.set(replacedClass, []);
    }
    graph.replacesChains.get(replacedClass).push({ className, replacedClass, filePath, line });
}

function createEmptyGraph() {
    return {
        actors: new Map(),
        sprites: new Set(),
        modelActorRefs: [],
        modelSpriteRefs: [],
        projectileRefs: [],
        startItemRefs: [],
        weaponSlotRefs: [],
        replacesChains: new Map(),
        inventoryOps: [],
        doubleAmmoStates: [],
        filesScanned: 0,
        reachableFiles: new Set(),
        orphanFiles: [],
        extraActors: new Set()
    };
}

/**
 * @param {string} baseDir
 * @param {{ignoreGlobs?:string[]}} [options]
 */
async function buildGzdoomSymbolGraph(baseDir, options = {}) {
    const graph = createEmptyGraph();
    const respectIncludes = options.respectIncludes !== false;
    if (Array.isArray(options.extraActors)) {
        for (const name of options.extraActors) graph.extraActors.add(name);
    }

    const files = await collectGzdoomFiles(baseDir, options);
    let reachableSet = null;

    if (respectIncludes) {
        const resolved = resolveReachableGzdoomFiles(baseDir, files);
        reachableSet = resolved.reachable;
        graph.orphanFiles = resolved.orphans;
        graph.reachableFiles = reachableSet;
    }

    for (const file of files) {
        if (file.kind === 'sprite') {
            graph.sprites.add(spriteNameFromAsset(file.relativePath));
            continue;
        }

        if (respectIncludes && reachableSet) {
            const relLower = file.relativePath.toLowerCase();
            const isZs = relLower.endsWith('.zs') || relLower.endsWith('.zscript');
            if (isZs && !reachableSet.has(file.relativePath) && !isAlwaysReachableSource(file.relativePath, file.name)) {
                continue;
            }
        }

        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }
        graph.filesScanned += 1;

        const lowerName = file.name.toLowerCase();
        const lowerPath = file.relativePath.toLowerCase();

        if (lowerName === 'modeldef' || lowerName === 'voxeldef' || lowerPath.endsWith('/modeldef') || lowerPath.endsWith('.def')) {
            ingestModelDef(content, file.relativePath, graph);
        }
        if (lowerName === 'decorate' || lowerPath.endsWith('.decorate') || lowerPath.endsWith('.dec')) {
            ingestDecorate(content, file.relativePath, graph);
        }
        if (lowerName === 'zscript' || lowerPath.endsWith('.zs') || lowerPath.endsWith('.zscript')) {
            ingestZScript(content, file.relativePath, graph);
        }
        if (lowerName === 'keyconf') {
            ingestKeyConf(content, file.relativePath, graph);
        }
        if (lowerName === 'mapinfo') {
            ingestMapInfo(content, file.relativePath, graph);
        }

        // Combined lumps (e.g. LOADACS.txt bundles) — scan all ingestors on unknown sources
        if (!GZDoom_FILE_NAMES.has(lowerName) && !GZDoom_EXTENSIONS.has(path.extname(lowerName))) {
            ingestModelDef(content, file.relativePath, graph);
            ingestDecorate(content, file.relativePath, graph);
            ingestZScript(content, file.relativePath, graph);
        }
    }

    return graph;
}

function actorResolvable(graph, className) {
    if (!className) return false;
    if (graph.actors.has(className)) return true;
    if (graph.extraActors.has(className)) return true;
    return isVanillaActor(className);
}

function actorExists(graph, className) {
    return actorResolvable(graph, className);
}

/**
 * @param {Object} graph
 * @param {{severity?:string}} [options]
 * @returns {Array<Object>}
 */
function validateGzdoomCrossReferences(graph, options = {}) {
    const severity = options.severity || 'high';
    const issues = [];

    for (const ref of graph.modelSpriteRefs) {
        if (graph.sprites.has(ref.sprite)) continue;
        issues.push(makeIssue({
            id: 'GZ-XREF-001',
            type: 'gzdoom-unresolved-sprite',
            severity,
            filePath: ref.filePath,
            line: ref.line,
            description: `${ref.filePath}:${ref.line} MODELDEF references sprite "${ref.sprite}" with no matching sprite lump`,
            recommendedAction: 'Add a sprite PNG under sprites/ or fix the FrameIndex sprite name'
        }));
    }

    for (const ref of graph.modelActorRefs) {
        if (actorExists(graph, ref.actor)) continue;
        issues.push(makeIssue({
            id: 'GZ-XREF-002',
            type: 'gzdoom-unresolved-actor',
            severity,
            filePath: ref.filePath,
            line: ref.line,
            description: `${ref.filePath}:${ref.line} MODELDEF Model "${ref.actor}" has no matching actor class`,
            recommendedAction: 'Define the actor in DECORATE or ZScript, or fix the Model name'
        }));
    }

    for (const ref of graph.projectileRefs) {
        if (actorExists(graph, ref.className)) continue;
        issues.push(makeIssue({
            id: 'GZ-XREF-003',
            type: 'gzdoom-unresolved-projectile',
            severity,
            filePath: ref.filePath,
            line: ref.line,
            description: `${ref.filePath}:${ref.line} A_FireProjectile references undefined actor "${ref.className}"`,
            recommendedAction: 'Define the projectile actor class or fix the class name string'
        }));
    }

    for (const ref of graph.startItemRefs) {
        if (actorExists(graph, ref.className)) continue;
        issues.push(makeIssue({
            id: 'GZ-XREF-004',
            type: 'gzdoom-unresolved-startitem',
            severity,
            filePath: ref.filePath,
            line: ref.line,
            description: `${ref.filePath}:${ref.line} StartItem/WeaponStartItem references undefined class "${ref.className}"`,
            recommendedAction: 'Define the inventory/ammo class or remove the StartItem entry'
        }));
    }

    for (const ref of graph.weaponSlotRefs) {
        if (actorExists(graph, ref.className)) continue;
        issues.push(makeIssue({
            id: 'GZ-XREF-005',
            type: 'gzdoom-unresolved-weaponslot',
            severity,
            filePath: ref.filePath,
            line: ref.line,
            description: `${ref.filePath}:${ref.line} WeaponSlot references undefined class "${ref.className}"`,
            recommendedAction: 'Define the weapon class or fix the KEYCONF WeaponSlot entry'
        }));
    }

    for (const [name, defs] of graph.actors.entries()) {
        const scoped = graph.reachableFiles.size > 0
            ? defs.filter((d) => graph.reachableFiles.has(d.filePath) || isAlwaysReachableSource(d.filePath, path.basename(d.filePath)))
            : defs;
        if (scoped.length <= 1) continue;
        issues.push(makeIssue({
            id: 'GZ-XREF-006',
            type: 'gzdoom-duplicate-class',
            severity,
            filePath: scoped[1].filePath,
            line: scoped[1].line,
            description: `Class "${name}" is defined ${scoped.length} times in compiled sources (${scoped.map((d) => `${d.filePath}:${d.line}`).join(', ')})`,
            recommendedAction: 'Remove duplicate class definitions or rename conflicting classes',
            affectedFiles: scoped.map((d) => d.filePath)
        }));
    }

    for (const [replacedClass, entries] of graph.replacesChains.entries()) {
        if (entries.length <= 1) continue;
        issues.push(makeIssue({
            id: 'GZ-XREF-007',
            type: 'gzdoom-replaces-conflict',
            severity,
            filePath: entries[1].filePath,
            line: entries[1].line,
            description: `Multiple classes replace "${replacedClass}": ${entries.map((e) => e.className).join(', ')}`,
            recommendedAction: 'Ensure only one class replaces a given actor, or verify PK3 load order',
            affectedFiles: entries.map((e) => e.filePath)
        }));
    }

    for (const state of graph.doubleAmmoStates) {
        issues.push(makeIssue({
            id: 'GZ-FLOW-001',
            type: 'gzdoom-double-ammo-consumption',
            severity: 'medium',
            filePath: state.filePath,
            line: state.line,
            description: `${state.filePath}:${state.line} fire state may consume "${state.ammoType}" twice (A_TakeInventory + A_FireProjectile useammo=true)`,
            recommendedAction: 'Remove redundant A_TakeInventory or set useammo=false on A_FireProjectile'
        }));
    }

    // GZ-FLOW-002: Inventory give/take asymmetry
    // For weapon classes that appear in TakeInventory calls, verify they also
    // appear in GiveInventory or StartItem somewhere in the codebase.
    const takenItems = new Set();
    for (const op of graph.inventoryOps) {
        if (op.op === 'take') takenItems.add(op.item);
    }
    const givenItems = new Set();
    for (const op of graph.inventoryOps) {
        if (op.op === 'give') givenItems.add(op.item);
    }
    // Also consider StartItem refs as "given"
    for (const ref of graph.startItemRefs) {
        givenItems.add(ref.className);
    }

    for (const item of takenItems) {
        if (givenItems.has(item)) continue;
        if (isVanillaActor(item)) continue;
        const takeOps = graph.inventoryOps.filter((op) => op.op === 'take' && op.item === item);
        const actionable = takeOps.filter((op) => !isIntentionalInventoryFunction(op.functionName || ''));
        if (actionable.length === 0) continue;
        const op = actionable[0];
        issues.push(makeIssue({
            id: 'GZ-FLOW-002',
            type: 'gzdoom-inventory-asymmetry',
            severity: 'medium',
            filePath: op.filePath,
            line: op.line,
            description: `${op.filePath}:${op.line} "${item}" is taken via TakeInventory but never given via GiveInventory or StartItem`,
            recommendedAction: `Add GiveInventory("${item}", 1) or Player.StartItem "${item}", or confirm removal is intentional cleanup`
        }));
    }

    return issues;
}

/**
 * Correlate parsed log entries with symbol graph source locations.
 * @param {Array<Object>} logEntries
 * @param {Object} graph
 * @returns {Array<Object>}
 */
function correlateLogEntries(logEntries, graph) {
    const issues = [];
    for (const entry of logEntries || []) {
        if (entry.kind === 'unknown-sprite') {
            const ref = graph.modelSpriteRefs.find((r) => r.sprite === String(entry.details.sprite || '').toUpperCase());
            issues.push(makeIssue({
                id: entry.id,
                type: 'gzdoom-runtime-unknown-sprite',
                severity: entry.severity,
                filePath: ref?.filePath || null,
                line: ref?.line || entry.line,
                description: `Runtime: ${entry.text}`,
                recommendedAction: ref
                    ? `Fix sprite "${entry.details.sprite}" at ${ref.filePath}:${ref.line}`
                    : `Add sprite "${entry.details.sprite}" referenced by model ${entry.details.modelName}`
            }));
            continue;
        }
        if (entry.kind === 'unknown-class' || entry.kind === 'duplicate-class') {
            const name = entry.details.className;
            const defs = graph.actors.get(name) || [];
            const target = defs[0] || defs[1];
            issues.push(makeIssue({
                id: entry.id,
                type: `gzdoom-runtime-${entry.kind}`,
                severity: entry.severity,
                filePath: target?.filePath || null,
                line: target?.line || entry.line,
                description: `Runtime: ${entry.text}`,
                recommendedAction: entry.kind === 'duplicate-class'
                    ? `Remove duplicate definition of "${name}"`
                    : `Define actor "${name}" or fix the reference`,
                affectedFiles: defs.map((d) => d.filePath)
            }));
            continue;
        }
        if (entry.kind === 'replaces-conflict') {
            const replaced = entry.details.replacedClass;
            const chain = graph.replacesChains.get(replaced) || [];
            issues.push(makeIssue({
                id: entry.id,
                type: 'gzdoom-runtime-replaces-conflict',
                severity: entry.severity,
                filePath: chain[0]?.filePath || null,
                line: chain[0]?.line || entry.line,
                description: `Runtime: ${entry.text}`,
                recommendedAction: `Resolve replacement conflict for "${replaced}"`,
                affectedFiles: chain.map((c) => c.filePath)
            }));
            continue;
        }
        if (entry.kind === 'script-error' || entry.kind === 'parse-error' || entry.kind === 'missing-string') {
            issues.push(makeIssue({
                id: entry.id,
                type: `gzdoom-runtime-${entry.kind}`,
                severity: entry.severity,
                filePath: entry.details.filePath || null,
                line: entry.details.line || entry.line,
                description: `Runtime: ${entry.text}`,
                recommendedAction: entry.details.message || 'Fix the script error reported in the runtime log'
            }));
            continue;
        }
        // R3D / mod runtime diagnostics (CVAR mismatch, light cap, missing managers)
        if (['cvar-mismatch', 'cvar-render-conflict', 'light-capacity', 'manager-missing', 'render-mode-split', 'cvar-protected'].includes(entry.kind)) {
            issues.push(makeIssue({
                id: entry.id,
                type: `gzdoom-runtime-${entry.kind}`,
                severity: entry.severity,
                filePath: null,
                line: entry.line,
                description: `Runtime: ${entry.text}`,
                recommendedAction: entry.kind === 'light-capacity'
                    ? 'Raise r3d_unified_max_lights / r3d_max_lights_per_frame or disable auto performance mode'
                    : entry.kind.startsWith('cvar')
                        ? 'Align r_models=1, r_drawvoxels=0 via R3D Render menu or autoexec'
                        : 'Review runtime subsystem registration in MAPINFO / manifest',
                metadata: entry.details
            }));
        }
    }
    return issues;
}

function makeIssue(fields) {
    return {
        count: 1,
        recommendedAction: fields.recommendedAction || 'Review GZDoom mod reference integrity',
        affectedFiles: fields.affectedFiles || (fields.filePath ? [fields.filePath] : []),
        metadata: { engine: 'gzdoom-integrity' },
        ...fields
    };
}

module.exports = {
    buildGzdoomSymbolGraph,
    validateGzdoomCrossReferences,
    correlateLogEntries,
    collectGzdoomFiles,
    createEmptyGraph,
    spriteNameFromAsset,
    actorResolvable,
    getFunctionNameAtLine
};
