/**
 * Tree-sitter WASM loader — Tier 1b (optional).
 * Gracefully degrades when web-tree-sitter or grammar files are absent.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const GRAMMAR_MAP = {
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  python: "tree-sitter-python.wasm",
  go: "tree-sitter-go.wasm",
};

let parserInitPromise = null;
let Parser = null;

/**
 * Resolve wasm dir.
 * @param {Object} options
 * @returns {any}
 */
function resolveWasmDir(options = {}) {
  if (options.wasmDir) return path.resolve(options.wasmDir);
  return path.join(__dirname, "..", "grammars");
}

/**
 * Grammar path.
 * @param {any} language
 * @param {Object} options
 * @returns {any}
 */
function grammarPath(language, options = {}) {
  const fileName = GRAMMAR_MAP[language];
  if (!fileName) return null;
  return path.join(resolveWasmDir(options), fileName);
}

/**
 * Is grammar available.
 * @param {any} language
 * @param {Object} options
 * @returns {any}
 */
function isGrammarAvailable(language, options = {}) {
  const wasmPath = grammarPath(language, options);
  return wasmPath != null && fs.existsSync(wasmPath);
}

/**
 * Load web tree sitter.
 * @returns {any}
 */
function loadWebTreeSitter() {
  try {
    return require("web-tree-sitter");
  } catch {
    return null;
  }
}

/**
 * Init parser.
 * @param {Object} options
 * @returns {any}
 */
async function initParser(options = {}) {
  if (parserInitPromise) return parserInitPromise;

  parserInitPromise = (async () => {
    const WebTreeSitter = loadWebTreeSitter();
    if (!WebTreeSitter) {
      return {
        ready: false,
        reason:
          "web-tree-sitter not installed — run npm install in @simplebeacon/intelligence",
      };
    }

    await WebTreeSitter.init();
    Parser = WebTreeSitter;
    return { ready: true, Parser: WebTreeSitter };
  })();

  return parserInitPromise;
}

/**
 * Create language parser.
 * @param {any} language
 * @param {Object} options
 * @returns {any}
 */
async function createLanguageParser(language, options = {}) {
  const init = await initParser(options);
  if (!init.ready) return { ok: false, reason: init.reason };

  const wasmPath = grammarPath(language, options);
  if (!wasmPath || !fs.existsSync(wasmPath)) {
    // simplebeacon-ignore sync-io — existence check before async WASM load
    return {
      ok: false,
      reason: `Grammar WASM missing for ${language} — run: npm run fetch-grammars`,
    };
  }

  const wasmBuffer = await fs.promises.readFile(wasmPath);
  const lang = await Parser.Language.load(wasmBuffer);
  const parser = new Parser();
  parser.setLanguage(lang);

  return { ok: true, parser, language };
}

/**
 * Parse with tree sitter.
 * @param {any} content
 * @param {any} language
 * @param {Object} options
 * @returns {any}
 */
async function parseWithTreeSitter(content, language, options = {}) {
  const result = await createLanguageParser(language, options);
  if (!result.ok) return result;

  const tree = result.parser.parse(content);
  return { ok: true, tree, parser: result.parser, language };
}

/**
 * Get tree sitter status.
 * @param {Object} options
 * @returns {any}
 */
function getTreeSitterStatus(options = {}) {
  const wasmDir = resolveWasmDir(options);
  const grammars = {};
  for (const lang of Object.keys(GRAMMAR_MAP)) {
    grammars[lang] = isGrammarAvailable(lang, options);
  }

  return {
    webTreeSitterInstalled: loadWebTreeSitter() != null,
    wasmDir,
    grammarsAvailable: grammars,
    ready: loadWebTreeSitter() != null && Object.values(grammars).some(Boolean),
  };
}

export {
  GRAMMAR_MAP,
  initParser,
  createLanguageParser,
  parseWithTreeSitter,
  isGrammarAvailable,
  getTreeSitterStatus,
  resolveWasmDir,
};
