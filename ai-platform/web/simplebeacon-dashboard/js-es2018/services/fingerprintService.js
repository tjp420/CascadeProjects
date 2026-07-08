/**
 * Structural fingerprinting for dropped folders.
 *
 * Identifies the program or framework inside a directory by walking its
 * contents and matching against known file/folder markers. No file contents are
 * read; only relative paths and names are inspected.
 */
const MAX_DISCOVERED_ENTRIES = Number.MAX_SAFE_INTEGER;
const MAX_DEPTH = 32;
const FINGERPRINT_PROFILES = [
    {
        id: 'nodejs',
        name: 'Node.js Project',
        confidence: 95,
        requiredMatchMode: 'any',
        required: [/^package\.json$/i],
        optional: [/^node_modules\//i, /^package-lock\.json$/i, /^yarn\.lock$/i, /^pnpm-lock\.yaml$/i, /^tsconfig\.json$/i]
    },
    {
        id: 'python',
        name: 'Python Project',
        confidence: 90,
        requiredMatchMode: 'any',
        required: [/^requirements\.txt$/i, /^pyproject\.toml$/i, /^setup\.py$/i, /^setup\.cfg$/i],
        optional: [/^\.venv\//i, /^venv\//i, /^__pycache__\//i, /^poetry\.lock$/i, /^Pipfile$/i]
    },
    {
        id: 'java-maven',
        name: 'Java / Maven Project',
        confidence: 90,
        requiredMatchMode: 'any',
        required: [/^pom\.xml$/i],
        optional: [/^src\//i, /^target\//i, /^\.mvn\//i, /^mvnw$/i]
    },
    {
        id: 'dotnet',
        name: '.NET Project',
        confidence: 90,
        requiredMatchMode: 'any',
        required: [/\.csproj$/i, /\.sln$/i],
        optional: [/\.cs$/i, /^obj\//i, /^bin\//i, /^\.vs\//i, /^global\.json$/i]
    },
    {
        id: 'golang',
        name: 'Go Project',
        confidence: 90,
        requiredMatchMode: 'any',
        required: [/^go\.mod$/i],
        optional: [/^go\.sum$/i, /^main\.go$/i, /^cmd\//i, /^pkg\//i]
    },
    {
        id: 'rust',
        name: 'Rust Project',
        confidence: 90,
        requiredMatchMode: 'any',
        required: [/^Cargo\.toml$/i],
        optional: [/^Cargo\.lock$/i, /^src\//i, /^target\//i, /^rust-toolchain$/i]
    },
    {
        id: 'unity',
        name: 'Unity Game / Project',
        confidence: 95,
        requiredMatchMode: 'all',
        required: [/^Assets\//i, /^ProjectSettings\//i],
        optional: [/^Packages\//i, /^Library\//i, /\.unity$/i, /^ProjectSettings\/Unity.*\.asset$/i]
    },
    {
        id: 'unreal',
        name: 'Unreal Engine Project',
        confidence: 95,
        requiredMatchMode: 'all',
        required: [/^Engine\//i, /\.uproject$/i],
        optional: [/^Content\//i, /^Config\//i, /^Source\//i, /^Plugins\//i, /^Binaries\//i]
    },
    {
        id: 'godot',
        name: 'Godot Project',
        confidence: 95,
        requiredMatchMode: 'any',
        required: [/^project\.godot$/i],
        optional: [/^assets\//i, /^src\//i, /^scenes\//i, /^scripts\//i, /\.tscn$/i, /\.gd$/i]
    },
    {
        id: 'steam',
        name: 'Steam Client / Game Directory',
        confidence: 100,
        requiredMatchMode: 'any',
        required: [/^steam\.exe$/i, /^steamapps\//i],
        optional: [/^steam\.sh$/i, /^steamui\//i, /^logs\//i, /^userdata\//i]
    },
    {
        id: 'adobe-photoshop',
        name: 'Adobe Photoshop Installation',
        confidence: 100,
        requiredMatchMode: 'all',
        required: [/^photoshop\.exe$/i, /^Required\//i],
        optional: [/^Plug-Ins\//i, /^Presets\//i, /^Locales\//i, /^AMT\//i]
    },
    {
        id: 'microsoft-office',
        name: 'Microsoft Office Installation',
        confidence: 100,
        requiredMatchMode: 'any',
        required: [/^winword\.exe$/i, /^excel\.exe$/i, /^powerpnt\.exe$/i, /^outlook\.exe$/i],
        optional: [/^Office\//i, /^Office16\//i, /^Office15\//i, /\.mui$/i]
    },
    {
        id: 'visual-studio',
        name: 'Visual Studio Installation',
        confidence: 100,
        requiredMatchMode: 'all',
        required: [/^devenv\.exe$/i, /^Common7\//i],
        optional: [/^MSBuild\//i, /^Team Tools\//i, /^VB\//i, /^VC\//i, /^Xml\//i]
    },
    {
        id: 'vscode',
        name: 'Visual Studio Code: Workspace',
        confidence: 90,
        requiredMatchMode: 'any',
        required: [/^\.vscode\//i],
        optional: [/^code\.exe$/i, /^settings\.json$/i, /^launch\.json$/i, /^tasks\.json$/i, /^extensions\.json$/i]
    },
    {
        id: 'jetbrains',
        name: 'JetBrains IDE Project',
        confidence: 90,
        requiredMatchMode: 'any',
        required: [/^\.idea\//i],
        optional: [/^rider64\.exe$/i, /^webstorm64\.exe$/i, /^pycharm64\.exe$/i, /^intellij64\.exe$/i, /^\.iml$/i]
    }
];
function normalizePath(path) {
    return path.replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
}
function pathMatches(path, pattern) {
    return pattern.test(path);
}
/**
 * Recursively collect relative paths from a FileSystemDirectoryHandle or
 * FileSystemDirectoryEntry. Caps total entries and depth to avoid freezing the
 * browser on large or symlink-looped directories.
 */
async function collectPaths(directoryHandle, paths = [], depth = 0, prefix = '') {
    if (depth > MAX_DEPTH || paths.length >= MAX_DISCOVERED_ENTRIES)
        return paths;
    try {
        if (directoryHandle.entries && typeof directoryHandle.entries === 'function') {
            // Modern FileSystemDirectoryHandle
            for await (const [name, handle] of directoryHandle.entries()) {
                if (paths.length >= MAX_DISCOVERED_ENTRIES)
                    break;
                const fullPath = prefix ? `${prefix}/${name}` : name;
                if (handle.kind === 'directory') {
                    await collectPaths(handle, paths, depth + 1, fullPath);
                }
                else if (handle.kind === 'file') {
                    paths.push(fullPath);
                }
            }
        }
        else if (directoryHandle.createReader && typeof directoryHandle.createReader === 'function') {
            // Legacy webkit FileSystemDirectoryEntry
            const reader = directoryHandle.createReader();
            const entries = [];
            let batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
            while (batch.length > 0) {
                entries.push(...batch);
                batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
                if (entries.length > MAX_DISCOVERED_ENTRIES)
                    break;
            }
            for (const entry of entries) {
                if (paths.length >= MAX_DISCOVERED_ENTRIES)
                    break;
                const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
                if (entry.isDirectory) {
                    await collectPaths(entry, paths, depth + 1, fullPath);
                }
                else if (entry.isFile) {
                    paths.push(fullPath);
                }
            }
        }
    }
    catch (_a) {
        // Skip unreadable directories
    }
    return paths;
}
/**
 * Match a collected path list against the fingerprint registry.
 * @param {string} rootName
 * @param {string[]} paths
 * @returns {{name:string, confidence:number, profile:string, totalFiles:number, metadata:Object}}
 */
export function identifyProgram(rootName, paths) {
    const normalized = paths.map(normalizePath);
    const totalFiles = normalized.length;
    const metadata = { executables: 0, dlls: 0 };
    for (const p of normalized) {
        if (p.endsWith('.exe'))
            metadata.executables += 1;
        if (p.endsWith('.dll'))
            metadata.dlls += 1;
    }
    let best = null;
    let bestScore = 0;
    let bestTieBreaker = 0;
    for (const profile of FINGERPRINT_PROFILES) {
        let requiredHits = 0;
        let optionalHits = 0;
        for (const pattern of profile.required) {
            if (normalized.some((p) => pathMatches(p, pattern))) {
                requiredHits += 1;
            }
        }
        const matchMode = profile.requiredMatchMode || 'any';
        if (profile.required.length > 0) {
            if (matchMode === 'all' && requiredHits !== profile.required.length)
                continue;
            if (matchMode === 'any' && requiredHits === 0)
                continue;
        }
        for (const pattern of profile.optional) {
            if (normalized.some((p) => pathMatches(p, pattern))) {
                optionalHits += 1;
            }
        }
        const optionalCoverage = profile.optional.length > 0 ? optionalHits / profile.optional.length : 0;
        const score = matchMode === 'all' ? 1.0 : 0.9 + optionalCoverage * 0.1;
        const tieBreaker = optionalCoverage;
        if (score > bestScore || (score === bestScore && tieBreaker > bestTieBreaker)) {
            bestScore = score;
            bestTieBreaker = tieBreaker;
            best = {
                id: profile.id,
                name: profile.name,
                confidence: Math.round(profile.confidence * score),
                profile: profile.id,
                totalFiles,
                metadata,
                matchedRequired: requiredHits,
                matchedOptional: optionalHits
            };
        }
    }
    if (best && best.confidence >= 50)
        return best;
    return {
        id: 'unknown',
        name: 'Unknown Program / Custom Software',
        confidence: 0,
        profile: 'unknown',
        totalFiles,
        metadata,
        matchedRequired: 0,
        matchedOptional: 0
    };
}
/**
 * Fingerprint a dropped directory handle.
 * @param {FileSystemDirectoryHandle|FileSystemDirectoryEntry} directoryHandle
 * @param {string} rootName
 * @returns {Promise<{name:string, confidence:number, profile:string, totalFiles:number, metadata:Object}>}
 */
export async function fingerprintDirectory(directoryHandle, rootName = '') {
    const paths = await collectPaths(directoryHandle);
    return identifyProgram(rootName || directoryHandle.name || 'folder', paths);
}
/**
 * Format a fingerprint result for display in the UI.
 */
export function formatFingerprint(result) {
    if (!result)
        return '';
    const exe = result.metadata.executables || 0;
    const dll = result.metadata.dlls || 0;
    const parts = [
        `Detected: ${result.name}`,
        result.confidence > 0 ? `(${result.confidence}% confidence)` : '',
        `${result.totalFiles.toLocaleString()} files`,
        exe > 0 || dll > 0 ? `${exe} .exe, ${dll} .dll` : ''
    ];
    return parts.filter(Boolean).join(' · ');
}
