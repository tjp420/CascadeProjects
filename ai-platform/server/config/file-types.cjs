/**
 * File extension classification, lookup helpers, and file-type predicates.
 * @module file-types
 */

const path = require('path');

/** Recognized file extensions grouped by category. */
const EXTENSIONS = Object.freeze({
  CODE: Object.freeze([
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.py',
    '.cjs',
    '.mjs',
    '.vue',
    '.svelte',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.java',
    '.go',
    '.rs',
    '.rb',
    '.php',
    '.sql',
    '.sh',
    '.bash',
    '.zsh',
    '.fish',
    '.ps1',
    '.bat',
    '.cmd',
    '.cpp',
    '.c',
    '.h',
    '.hpp',
    '.cs',
    '.swift',
    '.kt',
    '.dart',
    '.coffee',
    '.wat',
    '.wasm',
    '.jl',
    '.cr',
    '.f',
    '.f90',
    '.f95',
    '.r',
    '.pl',
    '.lua',
    '.elm',
    '.clj',
    '.scala',
    '.groovy',
    '.gradle',
    '.d',
    '.erl',
    '.ex',
    '.fs',
    '.hs',
    '.ml',
    '.nim',
    '.pas',
    '.pp',
    '.tcl',
    '.v',
    '.zig',
    '.zs',
    '.acs',
    '.dec',
    '.decorate',
    '.glsl',
    '.vert',
    '.frag',
    '.geo',
    '.wgsl',
  ]),
  CONFIG: Object.freeze([
    '.json',
    '.yaml',
    '.yml',
    '.ini',
    '.toml',
    '.env',
    '.lock',
    '.conf',
    '.cfg',
    '.properties',
    '.nix',
    '.tf',
    '.hcl',
    '.editorconfig',
    '.gitignore',
    '.dockerignore',
  ]),
  MARKUP: Object.freeze([
    '.html',
    '.htm',
    '.xml',
    '.svg',
    '.xsl',
    '.xhtml',
    '.dtd',
    '.erb',
    '.ejs',
    '.pug',
    '.jade',
    '.hbs',
    '.handlebars',
    '.liquid',
    '.njk',
    '.mustache',
    '.slim',
  ]),
  DOCUMENT: Object.freeze([
    '.md',
    '.txt',
    '.rst',
    '.adoc',
    '.org',
    '.wiki',
    '.tex',
    '.ltx',
    '.ipynb',
    '.qmd',
    '.rmd',
  ]),
  DATA: Object.freeze([
    '.csv',
    '.tsv',
    '.json',
    '.xml',
    '.yaml',
    '.yml',
    '.parquet',
    '.avro',
    '.proto',
    '.sql',
    '.sqlite',
    '.db',
    '.dbf',
    '.accdb',
    '.mdb',
  ]),
  STYLESHEET: Object.freeze(['.css', '.scss', '.sass', '.less', '.styl', '.pcss', '.postcss']),
  IMAGE: Object.freeze([
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.bmp',
    '.webp',
    '.svg',
    '.ico',
    '.tiff',
    '.tif',
    '.heic',
    '.heif',
    '.avif',
    '.jxl',
    '.raw',
    '.cr2',
    '.nef',
    '.orf',
    '.sr2',
    '.dng',
    '.eps',
    '.psd',
    '.xcf',
    '.ai',
  ]),
  MEDIA: Object.freeze([
    '.mp3',
    '.mp4',
    '.wav',
    '.ogg',
    '.oga',
    '.ogv',
    '.webm',
    '.avi',
    '.mov',
    '.mkv',
    '.flac',
    '.aac',
    '.m4a',
    '.wma',
    '.mid',
    '.midi',
    '.opus',
    '.m4v',
    '.wmv',
    '.flv',
    '.swf',
    '.3gp',
    '.aiff',
  ]),
  BINARY: Object.freeze([
    '.exe',
    '.dll',
    '.so',
    '.dylib',
    '.bin',
    '.dat',
    '.db',
    '.dbf',
    '.zip',
    '.tar',
    '.gz',
    '.bz2',
    '.xz',
    '.7z',
    '.rar',
    '.cab',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.odt',
    '.ods',
    '.odp',
    '.epub',
    '.mobi',
    '.azw',
    '.azw3',
    '.ttf',
    '.otf',
    '.woff',
    '.woff2',
    '.eot',
  ]),
});

/** Flat array of all unique recognized extensions (frozen, sorted). */
const ALL_EXTENSIONS = Object.freeze([...new Set(Object.values(EXTENSIONS).flat())].sort());

/** O(1) lookup Sets for each category. */
const EXTENSION_SETS = Object.freeze(
  Object.fromEntries(Object.entries(EXTENSIONS).map(([k, v]) => [k, Object.freeze(new Set(v))]))
);

/** Frozen Set of every recognized extension across all categories. */
const ALL_EXTENSION_SET = Object.freeze(new Set(ALL_EXTENSIONS));

/** Reverse map: extension (lowercase) → category name (first category wins). */
const EXT_TO_CATEGORY = Object.freeze(
  Object.entries(EXTENSIONS).reduce((map, [cat, exts]) => {
    for (const ext of exts) {
      if (!(ext in map)) map[ext] = cat;
    }
    return map;
  }, {})
);

/** Small LRU cache for _getLowerExt. */
const _extCache = new Map();
const MAX_EXT_CACHE = 20000;
let _extCacheHits = 0;
let _extCacheMisses = 0;

/**
 * Extract the file extension from a path basename, lower-cased.
 * @param {string} filePath
 * @returns {string}
 */
function _getLowerExt(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  let base;
  try {
    base = path.basename(filePath);
  } catch {
    return '';
  }
  if (!base || typeof base !== 'string') return '';
  const cached = _extCache.get(base);
  if (cached !== undefined) {
    _extCache.delete(base);
    _extCache.set(base, cached);
    _extCacheHits += 1;
    return cached;
  }
  const idx = base.lastIndexOf('.');
  const result = idx < 0 || idx === base.length - 1 ? '' : base.slice(idx).toLowerCase();
  if (_extCache.size >= MAX_EXT_CACHE) {
    const oldest = _extCache.keys().next().value;
    if (oldest) _extCache.delete(oldest);
  }
  _extCache.set(base, result);
  _extCacheMisses += 1;
  return result;
}

/**
 * Clear the internal extension cache.
 * @returns {void}
 */
function clearExtCache() {
  _extCache.clear();
  _extCacheHits = 0;
  _extCacheMisses = 0;
}

/**
 * Check if a file path ends with a recognized extension.
 * @param {string} filePath
 * @param {string} [category] Optional category to narrow check.
 * @returns {boolean}
 */
function hasExtension(filePath, category = undefined) {
  const ext = _getLowerExt(filePath);
  if (!ext) return false;
  const set =
    typeof category === 'string' && category !== '' ? EXTENSION_SETS[category] : ALL_EXTENSION_SET;
  if (!set) return false;
  return set.has(ext);
}

/**
 * Get the category name for a given file extension, or undefined.
 * @param {string} filePath
 * @returns {string | undefined}
 */
function getExtensionCategory(filePath) {
  const ext = _getLowerExt(filePath);
  return ext ? EXT_TO_CATEGORY[ext] : undefined;
}

/** Return all recognized file extensions as a flat array. */
function getAllExtensions() {
  return ALL_EXTENSIONS.slice();
}

/** Get extensions for a single category. */
function getExtensionsForCategory(category) {
  if (typeof category !== 'string') return [];
  const arr = EXTENSIONS[category];
  return arr ? arr.slice() : [];
}

const _emptySet = Object.freeze(new Set());

/** Get the frozen Set for a category (or the full set if omitted). */
function getExtensionSet(category) {
  if (typeof category !== 'string' || category === '') return ALL_EXTENSION_SET;
  return EXTENSION_SETS[category] || _emptySet;
}

/** Return all category names. */
function getAllCategories() {
  return Object.keys(EXTENSIONS);
}

/** Check whether a category name is valid. */
function hasCategory(category) {
  return typeof category === 'string' && category !== '' && category in EXTENSIONS;
}

/** Return extension counts per category for diagnostics. */
function getExtensionStats() {
  const stats = {};
  for (const [cat, exts] of Object.entries(EXTENSIONS)) {
    stats[cat] = exts.length;
  }
  stats.total = ALL_EXTENSIONS.length;
  return Object.freeze(stats);
}

/**
 * Check if a file path matches any extension in one or more categories.
 * @param {string} filePath
 * @param {string|string[]} categories
 * @returns {boolean}
 */
function hasAnyExtension(filePath, categories) {
  const ext = _getLowerExt(filePath);
  if (!ext) return false;
  if (categories == null) return false;
  if (typeof categories !== 'string' && !Array.isArray(categories)) return false;
  const cats = Array.isArray(categories) ? categories : [categories];
  for (const cat of cats) {
    const set = EXTENSION_SETS[cat];
    if (set && set.has(ext)) return true;
  }
  return false;
}

/** Convenience check for scannable text files. */
function isTextFile(filePath) {
  return hasAnyExtension(filePath, ['CODE', 'CONFIG', 'MARKUP', 'DOCUMENT', 'DATA', 'STYLESHEET']);
}

/** Convenience check for code files. */
function isCodeFile(filePath) {
  return hasExtension(filePath, 'CODE');
}

/** Convenience check for config files. */
function isConfigFile(filePath) {
  return hasExtension(filePath, 'CONFIG');
}

/** Convenience check for markup/template files. */
function isMarkupFile(filePath) {
  return hasExtension(filePath, 'MARKUP');
}

/** Convenience check for document files. */
function isDocumentFile(filePath) {
  return hasExtension(filePath, 'DOCUMENT');
}

/** Convenience check for data files. */
function isDataFile(filePath) {
  return hasExtension(filePath, 'DATA');
}

/** Convenience check for stylesheet files. */
function isStylesheetFile(filePath) {
  return hasExtension(filePath, 'STYLESHEET');
}

/** Convenience check for image files. */
function isImageFile(filePath) {
  return hasExtension(filePath, 'IMAGE');
}

/** Convenience check for media (audio/video) files. */
function isMediaFile(filePath) {
  return hasExtension(filePath, 'MEDIA');
}

/** Convenience check for binary/document archive files. */
function isBinaryFile(filePath) {
  return hasExtension(filePath, 'BINARY');
}

/** Frozen Set of executable/library extensions. */
const EXECUTABLE_EXTENSIONS = Object.freeze(new Set(['.exe', '.dll', '.so', '.dylib', '.bin']));

/** Frozen Set of archive/compressed extensions. */
const ARCHIVE_EXTENSIONS = Object.freeze(
  new Set(['.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar', '.cab'])
);

/** Convenience check for executable/library files. */
function isExecutableFile(filePath) {
  const ext = _getLowerExt(filePath);
  return ext ? EXECUTABLE_EXTENSIONS.has(ext) : false;
}

/** Convenience check for archive/compressed files. */
function isArchiveFile(filePath) {
  const ext = _getLowerExt(filePath);
  return ext ? ARCHIVE_EXTENSIONS.has(ext) : false;
}

/** Frozen Set of lockfile names (basename match). */
const LOCK_FILE_NAMES = Object.freeze(
  new Set([
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    'cargo.lock',
    'gemfile.lock',
    'pipfile.lock',
    'poetry.lock',
    'mix.lock',
  ])
);

/** Frozen Set of package manifest names (basename match). */
const PACKAGE_FILE_NAMES = Object.freeze(
  new Set([
    'package.json',
    'cargo.toml',
    'composer.json',
    'gemfile',
    'pipfile',
    'requirements.txt',
    'go.mod',
    'build.gradle',
    'pom.xml',
    'cmakelists.txt',
    'setup.py',
    'pyproject.toml',
    'Cargo.toml',
  ])
);

/** Frozen Set of README-like names (without extension). */
const README_NAMES = Object.freeze(
  new Set([
    'readme',
    'changelog',
    'license',
    'licence',
    'contributing',
    'code_of_conduct',
    'security',
    'authors',
    'maintainers',
  ])
);

/** Convenience check for lock files. */
function isLockFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const base = path.basename(filePath).toLowerCase();
  return LOCK_FILE_NAMES.has(base);
}

/** Convenience check for package manifest files. */
function isPackageFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const base = path.basename(filePath).toLowerCase();
  return PACKAGE_FILE_NAMES.has(base);
}

/** Convenience check for README / docs / license files. */
function isReadmeFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const base = path.basename(filePath).toLowerCase();
  const name = base.replace(/\.[^.]+$/, '');
  return README_NAMES.has(name);
}

/** Convenience check for minified / bundled files. */
function isMinifiedFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const p = filePath.toLowerCase();
  return /\.(min|bundle)\.(js|css)$/i.test(p);
}

/** Convenience check for generated source files. */
function isGeneratedFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const p = filePath.toLowerCase();
  return (
    /\.(d\.ts|\.g\.dart|\.pb\.go|\.gen\.go|\.generated\.cs)$/i.test(p) ||
    /\.(designer\.cs|\.generated\.|\.auto\.|\.autogen\.)/i.test(p)
  );
}

/** Convenience check for source-map files. */
function isSourceMapFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  return filePath.toLowerCase().endsWith('.map');
}

/** Convenience check for ignore files. */
function isIgnoreFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const base = path.basename(filePath).toLowerCase();
  return ['.gitignore', '.dockerignore', '.eslintignore', '.prettierignore', '.npmignore'].includes(
    base
  );
}

/** Convenience check for CI/CD configuration files. */
function isCiConfigFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const base = path.basename(filePath).toLowerCase();
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  return (
    base === '.github' ||
    base === '.circleci' ||
    [
      '.gitlab-ci.yml',
      '.travis.yml',
      'appveyor.yml',
      'azure-pipelines.yml',
      'jenkinsfile',
      'bitrise.yml',
      'buildkite.yml',
    ].includes(base) ||
    p.includes('/.github/') ||
    p.includes('/.circleci/')
  );
}

/** Convenience check for Docker Compose files. */
function isDockerComposeFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const base = path.basename(filePath).toLowerCase();
  return ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'].includes(
    base
  );
}

/** Convenience check for dedicated license files. */
function isLicenseFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const name = path
    .basename(filePath)
    .toLowerCase()
    .replace(/\.[^.]+$/, '');
  return ['license', 'licence', 'copying', 'copyright'].includes(name);
}

/**
 * Group an array of file paths by their extension category.
 * @param {string[]} filePaths
 * @returns {Object<string, string[]>}
 */
function groupFilesByCategory(filePaths) {
  const groups = /** @type {Object<string, string[]>} */ ({});
  for (const cat of getAllCategories()) {
    groups[cat] = [];
  }
  groups['uncategorized'] = [];
  if (!Array.isArray(filePaths)) return groups;
  for (const p of filePaths) {
    const cat = getExtensionCategory(p);
    if (cat) groups[cat].push(p);
    else groups['uncategorized'].push(p);
  }
  return groups;
}

/**
 * Return cache diagnostics for the internal extension LRU cache.
 * @returns {{size:number, max:number, hitRate?:number, hits:number, misses:number}}
 */
function getExtCacheStats() {
  return Object.freeze({
    size: _extCache.size,
    max: MAX_EXT_CACHE,
    hits: _extCacheHits,
    misses: _extCacheMisses,
    hitRate:
      _extCacheHits + _extCacheMisses > 0
        ? _extCacheHits / (_extCacheHits + _extCacheMisses)
        : undefined,
  });
}

module.exports = Object.freeze({
  EXTENSIONS,
  ALL_EXTENSIONS,
  EXTENSION_SETS,
  ALL_EXTENSION_SET,
  EXT_TO_CATEGORY,
  hasExtension,
  hasAnyExtension,
  getExtensionCategory,
  getAllExtensions,
  getExtensionsForCategory,
  getExtensionSet,
  getAllCategories,
  hasCategory,
  isTextFile,
  isCodeFile,
  isConfigFile,
  isMarkupFile,
  isDocumentFile,
  isDataFile,
  isStylesheetFile,
  isImageFile,
  isMediaFile,
  isBinaryFile,
  isExecutableFile,
  isArchiveFile,
  isLockFile,
  isPackageFile,
  isReadmeFile,
  isMinifiedFile,
  isGeneratedFile,
  isSourceMapFile,
  isIgnoreFile,
  isCiConfigFile,
  isDockerComposeFile,
  isLicenseFile,
  groupFilesByCategory,
  getExtensionStats,
  clearExtCache,
  getExtCacheStats,
  EXECUTABLE_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  LOCK_FILE_NAMES,
  PACKAGE_FILE_NAMES,
  README_NAMES,
});
