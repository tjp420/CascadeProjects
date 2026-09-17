/**
 * In-memory transform for editor/scan text before it is pasted or sent
 * to an external model. Does not write the workspace disk.
 *
 * Settings are named AiContextOptimizeOptions so they do not collide with
 * src/settings/slopCopSettings.ts (monitoring policy).
 */

export interface AiContextOptimizeOptions {
  shaveRedundantComments: boolean;
  compressMarkdownFences: boolean;
  stripAiBoilerplate: boolean;
  injectStructuralAnchors: boolean;
  /** Hard cap on payload characters. Not a tokenizer measurement. */
  maxInputChars: number;
}

export interface OptimizedContext {
  payload: string;
  originalBytes: number;
  optimizedBytes: number;
  shavedBytes: number;
}

export const DEFAULT_AI_CONTEXT_OPTIMIZE: AiContextOptimizeOptions = {
  shaveRedundantComments: true,
  compressMarkdownFences: true,
  stripAiBoilerplate: true,
  injectStructuralAnchors: true,
  maxInputChars: 128000,
};

const KEEP_COMMENT_RE = /simplebeacon-ignore|slop-cop-disable/i;

const BOILERPLATE_PATTERNS = [
  /\/\/\s*Approved by AI Auto-Complete/gi,
  /\/\/\s*This function implements[^\n]*/gi,
  /^\s*\*\s*@class[^\n]*\n/gm,
];

export class AiContextOptimizer {
  constructor(private readonly settings: AiContextOptimizeOptions) {}

  optimize(
    filename: string,
    fileContent: string,
    workspaceTreeSummary?: string,
  ): OptimizedContext {
    const originalBytes = Buffer.byteLength(fileContent, "utf8");
    let processed = fileContent;

    if (this.settings.shaveRedundantComments) {
      processed = shaveComments(processed);
    }
    if (this.settings.stripAiBoilerplate) {
      processed = stripBoilerplate(processed);
    }
    if (this.settings.compressMarkdownFences) {
      processed = compressMarkdownFences(processed);
    }

    const afterHygiene = Buffer.byteLength(processed, "utf8");

    if (this.settings.injectStructuralAnchors && workspaceTreeSummary) {
      processed = injectAnchors(filename, processed, workspaceTreeSummary);
    }

    const cap = Math.max(500, Number(this.settings.maxInputChars) || 128000);
    if (processed.length > cap) {
      processed = processed.slice(0, cap);
    }

    const optimizedBytes = Buffer.byteLength(processed, "utf8");
    return {
      payload: processed,
      originalBytes,
      optimizedBytes,
      shavedBytes: Math.max(0, originalBytes - afterHygiene),
    };
  }
}

export function optimizeAiContext(
  filename: string,
  fileContent: string,
  workspaceTreeSummary?: string,
  settings: Partial<AiContextOptimizeOptions> = {},
): OptimizedContext {
  const optimizer = new AiContextOptimizer({
    ...DEFAULT_AI_CONTEXT_OPTIMIZE,
    ...settings,
  });
  return optimizer.optimize(filename, fileContent, workspaceTreeSummary);
}

export function prepareScanContextForModel(
  content: string,
  projectPath = "",
): string {
  return optimizeAiContext(
    "ai-context.md",
    content,
    projectPath ? ` - Project: ${projectPath}` : undefined,
    { shaveRedundantComments: false },
  ).payload;
}

export function shaveComments(content: string): string {
  const withoutBlocks = content.replace(/\/\*[\s\S]*?\*\//g, (block) => {
    if (KEEP_COMMENT_RE.test(block)) return block;
    return "";
  });
  const lines = withoutBlocks.split("\n").map((line) => {
    if (KEEP_COMMENT_RE.test(line)) return line;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") && !/https?:\/\//i.test(line)) {
      return "";
    }
    return line;
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function stripBoilerplate(content: string): string {
  let result = content;
  for (const pattern of BOILERPLATE_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result;
}

export function compressMarkdownFences(content: string): string {
  return content
    .replace(/```[\w-]*\s*```/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function injectAnchors(
  filename: string,
  content: string,
  treeSummary: string,
): string {
  const header =
    `/* [SIMPLEBEACON CONTEXT ANCHOR: START]\n` +
    ` * TARGET FILE: ${filename}\n` +
    ` * WORKSPACE COMPONENT MATRIX:\n${treeSummary}\n */\n`;
  const footer = `\n/* [SIMPLEBEACON CONTEXT ANCHOR: END FILE: ${filename}] */`;
  return `${header}${content}${footer}`;
}
