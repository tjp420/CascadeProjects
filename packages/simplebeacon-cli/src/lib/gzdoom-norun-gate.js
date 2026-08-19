/**
 * GZDoom authoritative syntax gate — runs gzdoom.exe -norun and parses errors.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseGzdoomLog } = require('./gzdoom-log-parser');

const KNOWN_GZDOOM_PATHS = [
    'F:/RetroFE/Collections/-Doom/Games/Doom/gzdoom.exe',
    'C:/Program Files/GZDoom/gzdoom.exe',
    'C:/Program Files (x86)/GZDoom/gzdoom.exe'
];

const IWAD_NAMES = ['doom2.wad', 'DOOM2.WAD', 'doom.wad', 'DOOM.WAD'];

function findGzdoomExe(override) {
    if (override && fs.existsSync(override)) return path.resolve(override);
    const env = process.env.GZDOOM_EXE;
    if (env && fs.existsSync(env)) return path.resolve(env);
    for (const candidate of KNOWN_GZDOOM_PATHS) {
        if (fs.existsSync(candidate)) return candidate;
    }
    try {
        const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['gzdoom'], {
            encoding: 'utf8',
            shell: true
        });
        const line = (which.stdout || '').split('\n').map((s) => s.trim()).find(Boolean);
        if (line && fs.existsSync(line)) return line;
    } catch {
        /* ignore */
    }
    return null;
}

function findIwad(gzdoomExe, override) {
    if (override && fs.existsSync(override)) return path.resolve(override);
    const env = process.env.GZDOOM_IWAD;
    if (env && fs.existsSync(env)) return path.resolve(env);
    const dir = path.dirname(gzdoomExe);
    for (const name of IWAD_NAMES) {
        const candidate = path.join(dir, name);
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

function resolveCompanionPaths(modPath, options = {}) {
    const paths = [path.resolve(modPath)];
    if (options.companionMod) {
        const sibling = path.resolve(path.dirname(modPath), options.companionMod);
        if (fs.existsSync(sibling)) paths.push(sibling);
    }
    for (const p of options.companionModPaths || []) {
        const resolved = path.isAbsolute(p) ? p : path.resolve(path.dirname(modPath), p);
        if (fs.existsSync(resolved)) paths.push(resolved);
    }
    return [...new Set(paths)];
}

function readConfigGzdoom(modPath) {
    const cfgPath = path.join(modPath, '.simplebeacon', 'config.json');
    if (!fs.existsSync(cfgPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(cfgPath, 'utf8')).gzdoom || {};
    } catch {
        return {};
    }
}

function logEntriesToErrors(entries) {
    return entries.map((e) => ({
        file: e.details?.filePath || 'unknown',
        line: e.details?.line || e.line || 0,
        type: e.kind || 'parse',
        message: e.details?.message || e.text || e.kind
    }));
}

/**
 * @param {string} modPath
 * @param {{gzdoomExe?:string,iwad?:string,timeoutMs?:number,dryRun?:boolean,companionMod?:string,companionModPaths?:string[]}} [options]
 */
function runGzdoomNorunGate(modPath, options = {}) {
    const gzdoomCfg = readConfigGzdoom(modPath);
    const opts = { ...gzdoomCfg, ...options };
    const modRoot = path.resolve(modPath);
    const filePaths = resolveCompanionPaths(modRoot, opts);
    const gzdoomExe = findGzdoomExe(opts.gzdoomExe);
    const iwad = gzdoomExe ? findIwad(gzdoomExe, opts.iwad) : null;
    const timeoutMs = opts.timeoutMs || opts.timeout || Number(process.env.GZDOOM_NORUN_TIMEOUT_MS) || 300000;

    const cmd = [];
    if (gzdoomExe) {
        cmd.push(gzdoomExe, '-norun', '-nosound');
        if (iwad) cmd.push('-iwad', iwad);
        for (const fp of filePaths) cmd.push('-file', fp);
    } else {
        cmd.push('gzdoom.exe', '-norun', '-nosound', '-file', modRoot);
    }

    const baseReport = {
        type: 'gzdoom-norun-gate',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        modPath: modRoot,
        filePaths,
        gzdoomExe,
        iwad,
        command: cmd,
        dryRun: Boolean(opts.dryRun)
    };

    if (opts.dryRun) {
        return {
            ...baseReport,
            exitCode: null,
            gatePass: null,
            setupError: gzdoomExe ? null : 'gzdoom.exe not found',
            errorCount: 0,
            warningCount: 0,
            errors: [],
            warnings: [],
            rawOutputTail: '[dry run]'
        };
    }

    if (!gzdoomExe) {
        return {
            ...baseReport,
            exitCode: null,
            gatePass: null,
            setupError: 'gzdoom.exe not found — set GZDOOM_EXE or use --gzdoom',
            errorCount: 0,
            warningCount: 0,
            errors: [],
            warnings: [],
            rawOutputTail: ''
        };
    }

    const result = spawnSync(cmd[0], cmd.slice(1), {
        encoding: 'utf8',
        timeout: timeoutMs,
        cwd: path.dirname(gzdoomExe),
        maxBuffer: 32 * 1024 * 1024,
        shell: false
    });

    if (result.error && result.error.code === 'ETIMEDOUT') {
        const stdout = result.stdout || '';
        const stderr = result.stderr || '';
        const combined = `${stderr}\n${stdout}`;
        const parsed = logEntriesToErrors(parseGzdoomLog(combined));
        return {
            ...baseReport,
            exitCode: null,
            gatePass: false,
            setupError: null,
            errorCount: parsed.length || 1,
            warningCount: 0,
            errors: parsed.length ? parsed : [{
                file: 'unknown',
                line: 0,
                type: 'timeout',
                message: `gzdoom.exe timed out after ${timeoutMs}ms`
            }],
            warnings: [],
            rawOutputTail: combined.split('\n').slice(-50).join('\n') || '[timeout]'
        };
    }

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const combined = `${stderr}\n${stdout}`;
    const parsed = logEntriesToErrors(parseGzdoomLog(combined));
    const exitCode = result.status ?? 1;
    // GZDoom -norun exits with 1337 (custom "didn't enter game loop" code) when parsing succeeds.
    // Exit 0 is also valid. Any other non-zero code is a failure.
    const norunSuccess = exitCode === 0 || exitCode === 1337;
    const gatePass = norunSuccess && parsed.length === 0;
    const rawLines = (stderr || stdout).split('\n');

    return {
        ...baseReport,
        exitCode,
        gatePass,
        setupError: null,
        errorCount: parsed.length,
        warningCount: 0,
        errors: parsed,
        warnings: [],
        rawOutputTail: rawLines.slice(-50).join('\n')
    };
}

module.exports = {
    runGzdoomNorunGate,
    findGzdoomExe,
    findIwad,
    resolveCompanionPaths
};
