/**
 * Compact, local AI context brief for the active editor.
 * Clipboard-only. Not a security verdict or tokenizer measurement.
 */

import * as fs from "fs";
import * as path from "path";

export type BriefDocument = {
  fileName: string;
  languageId: string;
  getText: () => string;
  uri: { fsPath: string };
};

const IMPORT_LIMIT = 30;
const FUNCTION_LIMIT = 50;

const FUNCTION_PATTERN =
  /(?:function\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\()/g;

function isImportLine(trimmed: string, languageId: string): boolean {
  if (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("require(") ||
    ((trimmed.startsWith("const ") ||
      trimmed.startsWith("let ") ||
      trimmed.startsWith("var ")) &&
      trimmed.includes("require("))
  ) {
    return true;
  }
  if (languageId === "python" || languageId === "python3") {
    return trimmed.startsWith("import ") || /^from\s+\S+\s+import\s/.test(trimmed);
  }
  return false;
}

export function collectImportLines(text: string, languageId: string): string[] {
  const imports: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (isImportLine(trimmed, languageId)) {
      imports.push(trimmed);
    }
  }
  return imports;
}

export function collectFunctionNames(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  FUNCTION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FUNCTION_PATTERN.exec(text)) !== null) {
    const name = match[1] || match[2];
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function buildContextBrief(
  document: BriefDocument,
  workspaceRoot?: string | null,
): string {
  const fsPath = document.uri.fsPath || document.fileName;
  const relativePath = workspaceRoot
    ? path.relative(workspaceRoot, fsPath).split(path.sep).join("/")
    : document.fileName;
  const text = document.getText();
  const lines = text.split(/\r?\n/);
  const imports = collectImportLines(text, document.languageId);
  const functions = collectFunctionNames(text);

  return [
    "[SIMPLEBEACON AI CONTEXT]",
    "",
    `File: ${relativePath}`,
    `Language: ${document.languageId}`,
    `Lines: ${lines.length}`,
    "",
    "IMPORTS / DEPENDENCIES:",
    ...(imports.length ? imports.slice(0, IMPORT_LIMIT) : ["None detected"]),
    "",
    "FUNCTIONS:",
    ...(functions.length
      ? functions.slice(0, FUNCTION_LIMIT).map((name) => `- ${name}`)
      : ["None detected"]),
    "",
    "AI CONSTRAINTS:",
    "- Work from the existing codebase.",
    "- Do not invent files, functions, APIs, or dependencies.",
    "- Do not modify unrelated files unless required.",
    "- Preserve existing behavior unless the user explicitly requests a behavior change.",
    "- Verify proposed symbols against the workspace before using them.",
    "",
    "IMPORTANT:",
    "This context was generated locally by SimpleBeacon.",
    "It is descriptive context, not a security verdict.",
  ].join("\n");
}

export const WORKSPACE_CONTEXT_CONSTRAINTS = [
  "preserve_existing_api",
  "no_new_dependencies",
  "avoid_unrelated_files",
  "do_not_invent_symbols",
] as const;

export type WorkspaceContextInput = {
  requestedFile?: string;
  verifySymbol?: string;
  verifySymbols?: string[];
};

export type SymbolStatus = "found" | "not_found";

export type WorkspaceEvidence = {
  claim: string;
  file: string;
  symbol?: string;
  exists: boolean;
};

export type WorkspaceContextPayload = {
  simplebeacon: {
    version: 2;
    operation: "workspace_verification";
    verified: boolean;
  };
  status: "ok" | "error";
  reason?: string;
  file: {
    path: string;
    exists: boolean;
  };
  functions: string[];
  imports: string[];
  relevantFiles: string[];
  unresolvedImports: string[];
  symbols: {
    verified: string[];
    notFound: string[];
    status: Record<string, SymbolStatus>;
  };
  verification: {
    symbol: string;
    status: SymbolStatus;
    file: string;
  }[];
  blockers: {
    type: "missing_file" | "missing_symbol";
    file: string;
    symbol?: string;
    status: "not_found";
    reason?: string;
  }[];
  constraints: string[];
  diagnostics: unknown[];
  evidence: WorkspaceEvidence[];
  language?: string;
  lines?: number;
  scope: {
    requestedFile: string;
    relatedFiles: string[];
  };
};

const RELATIVE_IMPORT_EXTS = ["", ".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx"];

export function pathExistsOnDisk(absPath: string): boolean {
  try {
    return fs.statSync(absPath).isFile();
  } catch {
    return false;
  }
}

export function toWorkspaceRelative(
  absPath: string,
  workspaceRoot?: string | null,
): string {
  const normalized = absPath.split(path.sep).join("/");
  if (!workspaceRoot) {
    return normalized;
  }
  return path.relative(workspaceRoot, absPath).split(path.sep).join("/");
}

export function resolveRelativeImport(
  fromFile: string,
  spec: string,
  existsFn: (absPath: string) => boolean = pathExistsOnDisk,
): string | null {
  if (!spec.startsWith(".")) {
    return null;
  }
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of RELATIVE_IMPORT_EXTS) {
    const candidate = base + ext;
    if (existsFn(candidate)) {
      return candidate;
    }
  }
  for (const ext of [".js", ".ts", ".mjs", ".cjs"]) {
    const indexFile = path.join(base, `index${ext}`);
    if (existsFn(indexFile)) {
      return indexFile;
    }
  }
  return null;
}

function requestedVerifySymbols(input?: WorkspaceContextInput): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const extras = [
    ...(input?.verifySymbol ? [input.verifySymbol] : []),
    ...(Array.isArray(input?.verifySymbols) ? input.verifySymbols : []),
  ];
  for (const raw of extras) {
    const name = String(raw || "").trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

function emptyVerificationPayload(
  reason: string,
  filePath = "",
  fileExists = false,
): WorkspaceContextPayload {
  return {
    simplebeacon: {
      version: 2,
      operation: "workspace_verification",
      verified: false,
    },
    status: "error",
    reason,
    file: { path: filePath, exists: fileExists },
    functions: [],
    imports: [],
    relevantFiles: fileExists && filePath ? [filePath] : [],
    unresolvedImports: [],
    symbols: { verified: [], notFound: [], status: {} },
    verification: [],
    blockers: fileExists
      ? []
      : filePath
        ? [
            {
              type: "missing_file",
              file: filePath,
              status: "not_found",
            },
          ]
        : [],
    constraints: [...WORKSPACE_CONTEXT_CONSTRAINTS],
    diagnostics: [],
    evidence: [
      {
        claim: reason,
        file: filePath,
        exists: fileExists,
      },
    ],
    scope: { requestedFile: filePath, relatedFiles: [] },
  };
}

const IMPORT_SPEC_RE = /(?:from\s+|require\s*\()\s*['"]([^'"]+)['"]/;

export function collectRelatedImportSpecs(text: string): string[] {
  const specs: string[] = [];
  const seen = new Set<string>();
  for (const line of collectImportLines(text, "javascript")) {
    const match = line.match(IMPORT_SPEC_RE);
    if (match && match[1] && !seen.has(match[1])) {
      seen.add(match[1]);
      specs.push(match[1]);
    }
  }
  return specs;
}

export function buildWorkspaceContextPayload(opts: {
  document: BriefDocument | null;
  workspaceRoot?: string | null;
  input?: WorkspaceContextInput;
  lineCount?: number;
  fileExists?: boolean;
  existsFn?: (absPath: string) => boolean;
}): WorkspaceContextPayload {
  const requestedHint = (opts.input?.requestedFile || "").trim();
  if (!opts.document) {
    const exists = opts.fileExists === true;
    const reason = requestedHint
      ? exists
        ? "Requested file could not be opened"
        : "Requested file does not exist"
      : "No active editor";
    return emptyVerificationPayload(
      reason,
      requestedHint.split(path.sep).join("/"),
      exists,
    );
  }

  const document = opts.document;
  const existsFn = opts.existsFn || pathExistsOnDisk;
  const fsPath = document.uri.fsPath || document.fileName;
  const relativePath = toWorkspaceRelative(fsPath, opts.workspaceRoot);
  const text = document.getText();
  const functions = collectFunctionNames(text).slice(0, FUNCTION_LIMIT);
  const imports = collectRelatedImportSpecs(text).slice(0, IMPORT_LIMIT);
  const unresolvedImports: string[] = [];
  const relevantFiles: string[] = [relativePath];
  const seenRelevant = new Set<string>([relativePath]);

  for (const spec of imports) {
    const resolved = resolveRelativeImport(fsPath, spec, existsFn);
    if (!resolved) {
      if (spec.startsWith(".")) {
        unresolvedImports.push(spec);
      }
      continue;
    }
    const rel = toWorkspaceRelative(resolved, opts.workspaceRoot);
    if (!seenRelevant.has(rel)) {
      seenRelevant.add(rel);
      relevantFiles.push(rel);
    }
  }

  const symbolStatus: Record<string, SymbolStatus> = {};
  const notFound: string[] = [];
  const verification: WorkspaceContextPayload["verification"] = [];
  const evidence: WorkspaceEvidence[] = [];

  for (const name of functions.slice(0, 8)) {
    evidence.push({
      claim: `function ${name} exists`,
      file: relativePath,
      symbol: name,
      exists: true,
    });
  }

  for (const verifySymbol of requestedVerifySymbols(opts.input)) {
    const found = functions.includes(verifySymbol);
    const status: SymbolStatus = found ? "found" : "not_found";
    symbolStatus[verifySymbol] = status;
    verification.push({
      symbol: verifySymbol,
      status,
      file: relativePath,
    });
    if (!found) {
      notFound.push(verifySymbol);
    }
    evidence.push({
      claim: `function ${verifySymbol} exists`,
      file: relativePath,
      symbol: verifySymbol,
      exists: found,
    });
  }

  const lineCount =
    typeof opts.lineCount === "number"
      ? opts.lineCount
      : text.split(/\r?\n/).length;

  return {
    simplebeacon: {
      version: 2,
      operation: "workspace_verification",
      verified: notFound.length === 0,
    },
    status: "ok",
    file: { path: relativePath, exists: true },
    functions,
    imports,
    relevantFiles,
    unresolvedImports,
    symbols: {
      verified: functions,
      notFound,
      status: symbolStatus,
    },
    verification,
    blockers: notFound.map((symbol) => ({
      type: "missing_symbol" as const,
      file: relativePath,
      symbol,
      status: "not_found" as const,
    })),
    constraints: [...WORKSPACE_CONTEXT_CONSTRAINTS],
    diagnostics: [],
    evidence,
    language: document.languageId,
    lines: lineCount,
    scope: {
      requestedFile: relativePath,
      relatedFiles: imports,
    },
  };
}
