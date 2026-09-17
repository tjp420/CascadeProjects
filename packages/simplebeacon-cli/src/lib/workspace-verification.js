"use strict";

/**
 * Agent preflight: verify workspace files/symbols/imports.
 * JSON facts only — no advice, no model calls.
 */

const fs = require("fs");
const path = require("path");

const CONSTRAINTS = [
  "preserve_existing_api",
  "no_new_dependencies",
  "avoid_unrelated_files",
  "do_not_invent_symbols",
];

const FUNCTION_PATTERN =
  /(?:function\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\()/g;

function normalizeRelative(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");
}

function isInsideRoot(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function safeWorkspacePath(workspaceRoot, relativePath) {
  const root = path.resolve(workspaceRoot);
  const raw = String(relativePath || "");
  const candidate = path.isAbsolute(raw)
    ? path.resolve(raw)
    : path.resolve(root, raw);
  if (!isInsideRoot(root, candidate)) {
    const err = new Error(`Path escapes workspace: ${relativePath}`);
    err.code = "PATH_ESCAPE";
    throw err;
  }
  return candidate;
}

function fileExists(workspaceRoot, relativePath) {
  try {
    return fs.statSync(safeWorkspacePath(workspaceRoot, relativePath)).isFile();
  } catch {
    return false;
  }
}

function collectFunctionNames(source) {
  const names = [];
  const seen = new Set();
  FUNCTION_PATTERN.lastIndex = 0;
  let match = FUNCTION_PATTERN.exec(source);
  while (match) {
    const name = match[1] || match[2];
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
    match = FUNCTION_PATTERN.exec(source);
  }
  const classRe = /\bclass\s+([A-Za-z0-9_$]+)/g;
  let classMatch = classRe.exec(source);
  while (classMatch) {
    if (!seen.has(classMatch[1])) {
      seen.add(classMatch[1]);
      names.push(classMatch[1]);
    }
    classMatch = classRe.exec(source);
  }
  return names;
}

function symbolExists(source, symbol) {
  return collectFunctionNames(source).includes(symbol);
}

function extractRelativeImports(source) {
  const imports = [];
  const seen = new Set();
  const patterns = [
    /(?:from\s+|require\s*\(|import\s*\()\s*['"](\.[^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      const spec = match[1];
      if (spec && !seen.has(spec)) {
        seen.add(spec);
        imports.push(spec);
      }
      match = pattern.exec(source);
    }
  }
  return imports;
}

function resolveRelativeImport(workspaceRoot, fromFile, importSpecifier) {
  if (!String(importSpecifier || "").startsWith(".")) {
    return null;
  }
  let fromAbs;
  try {
    fromAbs = safeWorkspacePath(workspaceRoot, fromFile);
  } catch {
    return null;
  }
  const base = path.dirname(fromAbs);
  const target = path.resolve(base, importSpecifier);
  const root = path.resolve(workspaceRoot);
  const candidates = [
    target,
    `${target}.js`,
    `${target}.jsx`,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.mjs`,
    `${target}.cjs`,
    path.join(target, "index.js"),
    path.join(target, "index.ts"),
  ];
  for (const candidate of candidates) {
    if (!isInsideRoot(root, candidate)) {
      continue;
    }
    try {
      if (fs.statSync(candidate).isFile()) {
        return normalizeRelative(path.relative(root, candidate));
      }
    } catch {
      // next candidate
    }
  }
  return null;
}

function buildRelevantFiles(workspaceRoot, requestedFile) {
  const relevantFiles = [normalizeRelative(requestedFile)];
  const unresolvedImports = [];
  if (!fileExists(workspaceRoot, requestedFile)) {
    return { relevantFiles, unresolvedImports };
  }
  const source = fs.readFileSync(
    safeWorkspacePath(workspaceRoot, requestedFile),
    "utf8",
  );
  for (const specifier of extractRelativeImports(source)) {
    const resolved = resolveRelativeImport(
      workspaceRoot,
      requestedFile,
      specifier,
    );
    if (resolved) {
      if (!relevantFiles.includes(resolved)) {
        relevantFiles.push(resolved);
      }
    } else {
      unresolvedImports.push(specifier);
    }
  }
  return { relevantFiles, unresolvedImports };
}

function requestedFilesFromInput(input) {
  const files = [];
  const seen = new Set();
  function add(value) {
    const name = normalizeRelative(value);
    if (name && !seen.has(name)) {
      seen.add(name);
      files.push(name);
    }
  }
  if (Array.isArray(input.files)) {
    for (const file of input.files) add(file);
  }
  if (input.requestedFile) add(input.requestedFile);
  if (Array.isArray(input.symbols)) {
    for (const row of input.symbols) {
      if (row && row.file) add(row.file);
    }
  }
  return files;
}

function requestedSymbolsFromInput(input) {
  const rows = [];
  const seen = new Set();
  function add(file, symbol) {
    const name = String(symbol || "").trim();
    const loc = normalizeRelative(file);
    if (!name || !loc) return;
    const key = `${loc}::${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ file: loc, symbol: name });
  }
  if (Array.isArray(input.symbols)) {
    for (const row of input.symbols) {
      if (row) add(row.file, row.symbol);
    }
  }
  const defaultFile = normalizeRelative(input.requestedFile || "");
  if (input.verifySymbol) add(defaultFile, input.verifySymbol);
  if (Array.isArray(input.verifySymbols)) {
    for (const name of input.verifySymbols) add(defaultFile, name);
  }
  return rows;
}

function verifyAgentRequest(input = {}) {
  const workspaceRoot = path.resolve(
    input.workspaceRoot || input.projectRoot || process.cwd(),
  );
  const normalizedFiles = requestedFilesFromInput(input);
  const fileResults = normalizedFiles.map((file) => ({
    path: file,
    exists: fileExists(workspaceRoot, file),
  }));

  const verification = [];
  const evidence = [];
  const blockers = [];

  for (const fileResult of fileResults) {
    if (!fileResult.exists) {
      blockers.push({
        type: "missing_file",
        file: fileResult.path,
        status: "not_found",
      });
      evidence.push({
        claim: `file ${fileResult.path} exists`,
        file: fileResult.path,
        exists: false,
      });
    }
  }

  for (const request of requestedSymbolsFromInput(input)) {
    if (!fileExists(workspaceRoot, request.file)) {
      verification.push({
        file: request.file,
        symbol: request.symbol,
        status: "not_found",
      });
      evidence.push({
        claim: `symbol ${request.symbol} exists in ${request.file}`,
        file: request.file,
        symbol: request.symbol,
        exists: false,
      });
      blockers.push({
        type: "missing_symbol",
        file: request.file,
        symbol: request.symbol,
        status: "not_found",
        reason: "file_not_found",
      });
      continue;
    }

    const source = fs.readFileSync(
      safeWorkspacePath(workspaceRoot, request.file),
      "utf8",
    );
    const exists = symbolExists(source, request.symbol);
    verification.push({
      file: request.file,
      symbol: request.symbol,
      status: exists ? "found" : "not_found",
    });
    evidence.push({
      claim: `symbol ${request.symbol} exists in ${request.file}`,
      file: request.file,
      symbol: request.symbol,
      exists,
    });
    if (!exists) {
      blockers.push({
        type: "missing_symbol",
        file: request.file,
        symbol: request.symbol,
        status: "not_found",
      });
    }
  }

  const relevantFiles = new Set();
  const unresolvedImports = [];
  for (const file of normalizedFiles) {
    const result = buildRelevantFiles(workspaceRoot, file);
    for (const relevant of result.relevantFiles) {
      relevantFiles.add(relevant);
    }
    unresolvedImports.push(...result.unresolvedImports);
  }

  const first = fileResults[0] || { path: "", exists: false };

  return {
    simplebeacon: {
      version: 2,
      operation: "workspace_verification",
      verified: blockers.length === 0,
    },
    files: fileResults,
    file: first,
    verification,
    relevantFiles: [...relevantFiles],
    unresolvedImports,
    evidence,
    blockers,
    constraints: CONSTRAINTS.slice(),
  };
}

module.exports = {
  verifyAgentRequest,
  collectFunctionNames,
  CONSTRAINTS,
};
