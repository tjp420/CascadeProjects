/**
 * Canonical language registry — extensions, families, and metadata for universal analysis.
 */

const path = require('path');

const UNIVERSAL_LANGUAGE_REGISTRY = {
  javascript: {
    id: 'javascript',
    label: 'JavaScript',
    family: 'web',
    priority: 1,
    parser: 'acorn',
    extensions: ['.js', '.mjs', '.cjs'],
  },
  typescript: {
    id: 'typescript',
    label: 'TypeScript',
    family: 'web',
    priority: 1,
    parser: 'typescript',
    extensions: ['.ts', '.tsx'],
  },
  jsx: {
    id: 'jsx',
    label: 'JSX',
    family: 'web',
    priority: 1,
    parser: 'acorn',
    extensions: ['.jsx'],
  },
  html: {
    id: 'html',
    label: 'HTML',
    family: 'web',
    priority: 1,
    parser: 'htmlparser2',
    extensions: ['.html', '.htm'],
  },
  css: {
    id: 'css',
    label: 'CSS',
    family: 'web',
    priority: 1,
    parser: 'postcss',
    extensions: ['.css', '.scss', '.less', '.sass'],
  },
  vue: { id: 'vue', label: 'Vue', family: 'web', priority: 1, parser: 'vue', extensions: ['.vue'] },
  svelte: {
    id: 'svelte',
    label: 'Svelte',
    family: 'web',
    priority: 1,
    parser: 'svelte',
    extensions: ['.svelte'],
  },
  json: {
    id: 'json',
    label: 'JSON',
    family: 'web',
    priority: 1,
    parser: 'json',
    extensions: ['.json'],
  },
  markdown: {
    id: 'markdown',
    label: 'Markdown',
    family: 'web',
    priority: 1,
    parser: 'markdown',
    extensions: ['.md', '.markdown'],
  },

  c: {
    id: 'c',
    label: 'C',
    family: 'systems',
    priority: 2,
    parser: 'tree-sitter-c',
    extensions: ['.c'],
  },
  cpp: {
    id: 'cpp',
    label: 'C++',
    family: 'systems',
    priority: 2,
    parser: 'tree-sitter-cpp',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh'],
  },
  cheader: {
    id: 'cheader',
    label: 'C Header',
    family: 'systems',
    priority: 2,
    parser: 'tree-sitter-c',
    extensions: ['.h'],
  },
  rust: {
    id: 'rust',
    label: 'Rust',
    family: 'systems',
    priority: 2,
    parser: 'tree-sitter-rust',
    extensions: ['.rs'],
  },
  go: {
    id: 'go',
    label: 'Go',
    family: 'systems',
    priority: 2,
    parser: 'tree-sitter-go',
    extensions: ['.go'],
  },
  assembly: {
    id: 'assembly',
    label: 'Assembly',
    family: 'systems',
    priority: 2,
    parser: 'tree-sitter-asm',
    extensions: ['.asm', '.s'],
  },
  zig: {
    id: 'zig',
    label: 'Zig',
    family: 'systems',
    priority: 2,
    parser: 'tree-sitter-zig',
    extensions: ['.zig'],
  },

  zscript: {
    id: 'zscript',
    label: 'ZScript',
    family: 'game',
    priority: 3,
    parser: 'custom-zscript',
    extensions: ['.zs', '.zscript'],
  },
  acs: {
    id: 'acs',
    label: 'ACS',
    family: 'game',
    priority: 3,
    parser: 'custom-acs',
    extensions: ['.acs'],
  },
  decorate: {
    id: 'decorate',
    label: 'DECORATE',
    family: 'game',
    priority: 3,
    parser: 'custom-decorate',
    extensions: ['.decorate'],
  },
  glsl: {
    id: 'glsl',
    label: 'GLSL',
    family: 'game',
    priority: 3,
    parser: 'glslang',
    extensions: ['.glsl', '.vert', '.frag'],
  },
  hlsl: {
    id: 'hlsl',
    label: 'HLSL',
    family: 'game',
    priority: 3,
    parser: 'hlsl',
    extensions: ['.hlsl', '.fx', '.fxh'],
  },
  lua: {
    id: 'lua',
    label: 'Lua',
    family: 'game',
    priority: 3,
    parser: 'tree-sitter-lua',
    extensions: ['.lua'],
  },

  swift: {
    id: 'swift',
    label: 'Swift',
    family: 'mobile',
    priority: 4,
    parser: 'sourcekit',
    extensions: ['.swift'],
  },
  objectivec: {
    id: 'objectivec',
    label: 'Objective-C',
    family: 'mobile',
    priority: 4,
    parser: 'clang',
    extensions: ['.m', '.mm'],
  },
  kotlin: {
    id: 'kotlin',
    label: 'Kotlin',
    family: 'mobile',
    priority: 4,
    parser: 'tree-sitter-kotlin',
    extensions: ['.kt', '.kts'],
  },
  java: {
    id: 'java',
    label: 'Java',
    family: 'mobile',
    priority: 4,
    parser: 'tree-sitter-java',
    extensions: ['.java'],
  },
  dart: {
    id: 'dart',
    label: 'Dart',
    family: 'mobile',
    priority: 4,
    parser: 'dart',
    extensions: ['.dart'],
  },

  python: {
    id: 'python',
    label: 'Python',
    family: 'data',
    priority: 5,
    parser: 'tree-sitter-python',
    extensions: ['.py', '.pyw'],
  },
  r: {
    id: 'r',
    label: 'R',
    family: 'data',
    priority: 5,
    parser: 'tree-sitter-r',
    extensions: ['.r', '.R'],
  },
  julia: {
    id: 'julia',
    label: 'Julia',
    family: 'data',
    priority: 5,
    parser: 'tree-sitter-julia',
    extensions: ['.jl'],
  },
  scala: {
    id: 'scala',
    label: 'Scala',
    family: 'data',
    priority: 5,
    parser: 'tree-sitter-scala',
    extensions: ['.scala', '.sc'],
  },
  matlab: {
    id: 'matlab',
    label: 'MATLAB',
    family: 'data',
    priority: 5,
    parser: 'matlab-parser',
    extensions: ['.mat'],
  },
  sql: {
    id: 'sql',
    label: 'SQL',
    family: 'data',
    priority: 5,
    parser: 'sql',
    extensions: ['.sql'],
  },

  dockerfile: {
    id: 'dockerfile',
    label: 'Dockerfile',
    family: 'devops',
    priority: 6,
    parser: 'dockerfile',
    extensions: ['.dockerfile'],
    basenames: ['dockerfile'],
  },
  yaml: {
    id: 'yaml',
    label: 'YAML',
    family: 'devops',
    priority: 6,
    parser: 'yaml',
    extensions: ['.yml', '.yaml'],
  },
  toml: {
    id: 'toml',
    label: 'TOML',
    family: 'devops',
    priority: 6,
    parser: 'toml',
    extensions: ['.toml'],
  },
  terraform: {
    id: 'terraform',
    label: 'Terraform',
    family: 'devops',
    priority: 6,
    parser: 'hcl',
    extensions: ['.tf', '.hcl'],
  },
  nginx: {
    id: 'nginx',
    label: 'Nginx',
    family: 'devops',
    priority: 6,
    parser: 'nginx',
    extensions: ['.conf'],
    basenames: ['nginx.conf'],
  },

  bash: {
    id: 'bash',
    label: 'Bash',
    family: 'scripting',
    priority: 7,
    parser: 'tree-sitter-bash',
    extensions: ['.sh', '.bash'],
  },
  powershell: {
    id: 'powershell',
    label: 'PowerShell',
    family: 'scripting',
    priority: 7,
    parser: 'tree-sitter-powershell',
    extensions: ['.ps1', '.psm1', '.psd1'],
  },
  ruby: {
    id: 'ruby',
    label: 'Ruby',
    family: 'scripting',
    priority: 7,
    parser: 'tree-sitter-ruby',
    extensions: ['.rb', '.rake'],
  },
  php: {
    id: 'php',
    label: 'PHP',
    family: 'scripting',
    priority: 7,
    parser: 'tree-sitter-php',
    extensions: ['.php'],
  },
  perl: {
    id: 'perl',
    label: 'Perl',
    family: 'scripting',
    priority: 7,
    parser: 'tree-sitter-perl',
    extensions: ['.pl', '.pm'],
  },

  solidity: {
    id: 'solidity',
    label: 'Solidity',
    family: 'domain',
    priority: 8,
    parser: 'tree-sitter-solidity',
    extensions: ['.sol'],
  },
  verilog: {
    id: 'verilog',
    label: 'Verilog',
    family: 'domain',
    priority: 8,
    parser: 'tree-sitter-verilog',
    extensions: ['.v', '.vh', '.sv'],
  },
  cobol: {
    id: 'cobol',
    label: 'COBOL',
    family: 'domain',
    priority: 8,
    parser: 'tree-sitter-cobol',
    extensions: ['.cob', '.cbl'],
  },
  fortran: {
    id: 'fortran',
    label: 'Fortran',
    family: 'domain',
    priority: 8,
    parser: 'fortran',
    extensions: ['.f', '.f90', '.f95'],
  },
  clojure: {
    id: 'clojure',
    label: 'Clojure',
    family: 'domain',
    priority: 8,
    parser: 'clojure',
    extensions: ['.clj', '.cljs'],
  },
  elixir: {
    id: 'elixir',
    label: 'Elixir',
    family: 'domain',
    priority: 8,
    parser: 'tree-sitter-elixir',
    extensions: ['.ex', '.exs'],
  },
  haskell: {
    id: 'haskell',
    label: 'Haskell',
    family: 'domain',
    priority: 8,
    parser: 'tree-sitter-haskell',
    extensions: ['.hs', '.lhs'],
  },
  erlang: {
    id: 'erlang',
    label: 'Erlang',
    family: 'domain',
    priority: 8,
    parser: 'tree-sitter-erlang',
    extensions: ['.erl', '.hrl'],
  },

  plaintext: {
    id: 'plaintext',
    label: 'Plain Text',
    family: 'web',
    priority: 1,
    parser: null,
    extensions: [
      '.txt',
      '.csv',
      '.tsv',
      '.log',
      '.ini',
      '.cfg',
      '.conf',
      '.properties',
      '.env',
      '.env.local',
      '.env.example',
    ],
  },
  xml: {
    id: 'xml',
    label: 'XML',
    family: 'web',
    priority: 1,
    parser: 'xml',
    extensions: ['.xml', '.xsd', '.xsl', '.xslt', '.svg', '.wsdl'],
  },
  document: {
    id: 'document',
    label: 'Document',
    family: 'web',
    priority: 1,
    parser: null,
    extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf'],
  },
  image: {
    id: 'image',
    label: 'Image',
    family: 'web',
    priority: 1,
    parser: null,
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg'],
  },
  archive: {
    id: 'archive',
    label: 'Archive',
    family: 'web',
    priority: 1,
    parser: null,
    extensions: ['.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar'],
  },
  audio: {
    id: 'audio',
    label: 'Audio',
    family: 'web',
    priority: 1,
    parser: null,
    extensions: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
  },
  video: {
    id: 'video',
    label: 'Video',
    family: 'web',
    priority: 1,
    parser: null,
    extensions: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
  },
};

const FAMILY_PROFILES = {
  default: ['web'],
  'game-dev': ['web', 'game'],
  universal: null,
};

const EXTENSION_INDEX = buildExtensionIndex(UNIVERSAL_LANGUAGE_REGISTRY);
const BASENAME_INDEX = buildBasenameIndex(UNIVERSAL_LANGUAGE_REGISTRY);

/**
 * Build extension index.
 * @param {string} registry
 * @returns {any}
 */
function buildExtensionIndex(registry) {
  const index = new Map();
  for (const entry of Object.values(registry)) {
    for (const ext of entry.extensions || []) {
      const key = String(ext).toLowerCase();
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(entry);
    }
  }
  for (const list of index.values()) {
    list.sort((a, b) => a.priority - b.priority);
  }
  return index;
}

/**
 * Build basename index.
 * @param {string} registry
 * @returns {any}
 */
function buildBasenameIndex(registry) {
  const index = new Map();
  for (const entry of Object.values(registry)) {
    for (const name of entry.basenames || []) {
      index.set(String(name).toLowerCase(), entry);
    }
  }
  return index;
}

/**
 * List registry languages.
 * @returns {any}
 */
function listRegistryLanguages() {
  return Object.values(UNIVERSAL_LANGUAGE_REGISTRY);
}

/**
 * Get registry entry.
 * @param {string} languageId
 * @returns {any}
 */
function getRegistryEntry(languageId) {
  return UNIVERSAL_LANGUAGE_REGISTRY[String(languageId || '').toLowerCase()] || null;
}

/**
 * Find languages by extension.
 * @param {any} extension
 * @returns {any}
 */
function findLanguagesByExtension(extension) {
  const key = String(extension || '').toLowerCase();
  if (!key) return [];
  return EXTENSION_INDEX.get(key) || [];
}

/**
 * Find language by basename.
 * @param {string} basename
 * @returns {any}
 */
function findLanguageByBasename(basename) {
  return BASENAME_INDEX.get(String(basename || '').toLowerCase()) || null;
}

/**
 * Resolve language from path.
 * @param {string} filePath
 * @returns {any}
 */
function resolveLanguageFromPath(filePath) {
  const base = path.basename(String(filePath || ''));
  const byName = findLanguageByBasename(base);
  if (byName) return byName;

  const ext = path.extname(base).toLowerCase();
  const matches = findLanguagesByExtension(ext);
  return matches[0] || null;
}

/**
 * Get extensions for families.
 * @param {Array} families
 * @returns {any}
 */
function getExtensionsForFamilies(families) {
  const set = new Set();
  for (const entry of listRegistryLanguages()) {
    if (families && !families.includes(entry.family)) continue;
    for (const ext of entry.extensions || []) set.add(ext.toLowerCase());
  }
  return set;
}

/**
 * Get extensions for profile.
 * @param {string} scanProfile
 * @returns {any}
 */
function getExtensionsForProfile(scanProfile) {
  const profile = String(scanProfile || process.env.SCAN_PROFILE || 'default').toLowerCase();
  if (profile === 'universal') {
    return getExtensionsForFamilies(null);
  }
  const families = FAMILY_PROFILES[profile] || FAMILY_PROFILES.default;
  const extensions = getExtensionsForFamilies(families);
  if (profile === 'default') {
    for (const ext of ['.zs', '.zscript']) extensions.add(ext);
  }
  return extensions;
}

/**
 * Build extension to language map.
 * @returns {any}
 */
function buildExtensionToLanguageMap() {
  const map = {};
  for (const entry of listRegistryLanguages()) {
    for (const ext of entry.extensions || []) {
      const key = ext.toLowerCase();
      if (!map[key]) map[key] = entry.id;
    }
  }
  return map;
}

module.exports = {
  UNIVERSAL_LANGUAGE_REGISTRY,
  FAMILY_PROFILES,
  listRegistryLanguages,
  getRegistryEntry,
  findLanguagesByExtension,
  findLanguageByBasename,
  resolveLanguageFromPath,
  getExtensionsForProfile,
  getExtensionsForFamilies,
  buildExtensionToLanguageMap,
};
