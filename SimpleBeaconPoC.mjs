import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _minimatch_mod = require("minimatch");
const minimatch =
  _minimatch_mod && typeof _minimatch_mod === "function"
    ? _minimatch_mod
    : _minimatch_mod && _minimatch_mod.minimatch
      ? _minimatch_mod.minimatch
      : null;
import swc from "@swc/core";

// ==========================================
// TIER B: UNIFIED TRIAGE & .SCANIGNORE ENGINE
// ==========================================
class ScanIgnoreMatcher {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.rules = [];
    this.loadDefaultRules();
  }

  loadDefaultRules() {
    // Core global defaults to eliminate file inflation (e.g., github-cache/)
    this.rules.push({ pattern: "**/github-cache/**", ignore: true });
    this.rules.push({ pattern: "**/node_modules/**", ignore: true });
    this.rules.push({ pattern: "**/dist/**", ignore: true });
    this.rules.push({ pattern: "**/build/**", ignore: true });
    this.rules.push({ pattern: "**/.git/**", ignore: true });
  }

  addIgnoreFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf-8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      // Handle explicit inclusion whitelist lines
      const isInclude = trimmed.startsWith("!");
      const pattern = isInclude ? trimmed.slice(1) : trimmed;

      // Normalize path matching strings
      const formattedPattern = pattern.startsWith("/")
        ? pattern.slice(1)
        : `**/${pattern}`;
      this.rules.push({ pattern: formattedPattern, ignore: !isInclude });
    });
  }

  isFileIgnored(absolutePath) {
    const relativePath = path
      .relative(this.baseDir, absolutePath)
      .replace(/\\/g, "/");
    let ignored = false;

    // Evaluate rule precedence: Later explicit rules override earlier defaults
    for (const rule of this.rules) {
      if (minimatch(relativePath, rule.pattern, { dot: true })) {
        ignored = rule.ignore;
      }
    }
    return ignored;
  }
}

// ==========================================
// TIER A: GRAPH ARTIFACTS & CYCLES ENGINE
// ==========================================
class SimpleBeaconEngine {
  constructor() {
    this.graph = new Map(); // file -> Set of imports
    this.fileMetrics = new Map(); // file -> total lines
    this.extensionCounts = {};
    this.totalLines = 0;
    this.totalFiles = 0;
  }

  registerDependency(sourceFile, importedFile) {
    if (!this.graph.has(sourceFile)) {
      this.graph.set(sourceFile, new Set());
    }
    this.graph.get(sourceFile).add(importedFile);
  }

  recordFileMetrics(filePath, lineCount) {
    this.totalFiles++;
    this.totalLines += lineCount;
    this.fileMetrics.set(filePath, lineCount);

    const ext = path.extname(filePath) || "(no ext)";
    this.extensionCounts[ext] = (this.extensionCounts[ext] || 0) + 1;
  }

  findCycles() {
    const indexMap = new Map();
    const lowLinkMap = new Map();
    const onStack = new Map();
    const stack = [];
    let index = 0;
    const cycles = [];

    const strongConnect = (node) => {
      indexMap.set(node, index);
      lowLinkMap.set(node, index);
      index++;
      stack.push(node);
      onStack.set(node, true);

      const edges = this.graph.get(node) || new Set();
      for (const neighbor of edges) {
        if (!indexMap.has(neighbor)) {
          strongConnect(neighbor);
          lowLinkMap.set(
            node,
            Math.min(lowLinkMap.get(node), lowLinkMap.get(neighbor)),
          );
        } else if (onStack.get(neighbor)) {
          lowLinkMap.set(
            node,
            Math.min(lowLinkMap.get(node), indexMap.get(neighbor)),
          );
        }
      }

      if (lowLinkMap.get(node) === indexMap.get(node)) {
        const component = [];
        let poppedNode;
        do {
          poppedNode = stack.pop();
          onStack.set(poppedNode, false);
          component.push(poppedNode);
        } while (poppedNode !== node);

        if (component.length > 1) {
          cycles.push(component);
        }
      }
    };

    for (const node of this.graph.keys()) {
      if (!indexMap.has(node)) {
        strongConnect(node);
      }
    }
    return cycles;
  }
}

// ==========================================
// TIER C: EU AI ACT COMPLIANCE FRAMEWORK
// ==========================================
class EuAiActEvaluator {
  constructor() {
    this.schemaRules = [
      {
        id: "RULE-EU-AI-01",
        article: "Article 52",
        title: "Undocumented Generative Flow Detection",
        description:
          "Verifies if an AI pipeline code component lacks transparency logging metadata blocks.",
        severity: "HIGH",
        confidence: "HIGH",
        autoFixable: true,
        suggestedPatch:
          "// TODO: Provide User Notice - Content generated by AI system under EU AI Act Art 52.\n",
      },
    ];
    this.findings = [];
  }

  evaluateFileAST(filePath, ast, sourceCode) {
    // Sample static AST rule evaluation path
    // Scan for common AI endpoints or placeholders if not documented
    if (sourceCode.includes("openai") || sourceCode.includes("llmPipeline")) {
      if (
        !sourceCode.includes("Article 52") &&
        !sourceCode.includes("AI-transparency")
      ) {
        const patchTarget = `// @simplebeacon-remediation: EU AI Act Compliance Banner\n${this.schemaRules[0].suggestedPatch}${sourceCode}`;
        this.findings.push({
          rule: this.schemaRules[0],
          filePath: filePath,
          detectedPattern:
            "Raw AI module imports found without statutory transparency headers.",
          suggestedPatchFileContent: patchTarget,
        });
      }
    }
  }
}

// ==========================================
// AST MIDDLEWARE INTEGRATION (SWC RUNNER)
// ==========================================
export async function runSimpleBeaconAudit(targetWorkspace) {
  const engine = new SimpleBeaconEngine();
  const ignoreMatcher = new ScanIgnoreMatcher(targetWorkspace);
  const complianceEvaluator = new EuAiActEvaluator();

  // Populate unified rule chains
  ignoreMatcher.addIgnoreFile(path.join(targetWorkspace, ".gitignore"));
  ignoreMatcher.addIgnoreFile(path.join(targetWorkspace, ".eslintignore"));
  ignoreMatcher.addIgnoreFile(
    path.join(targetWorkspace, ".simplebeaconignore"),
  );

  async function traverseDirectory(currentDir) {
    let files;
    try {
      files = fs.readdirSync(currentDir);
    } catch (e) {
      return;
    }
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }

      if (stat.isDirectory()) {
        if (!ignoreMatcher.isFileIgnored(fullPath)) {
          await traverseDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        if (ignoreMatcher.isFileIgnored(fullPath)) continue;

        const ext = path.extname(fullPath);
        if ([".js", ".ts", ".tsx", ".jsx", ".cjs"].includes(ext)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n").length;
          engine.recordFileMetrics(fullPath, lines);

          try {
            // SWC Parser Configuration Passes
            const ast = await swc.parse(content, {
              syntax: ext.includes("ts") ? "typescript" : "ecmascript",
              tsx: ext.includes("x"),
              target: "es2022",
            });

            // Extract active module dependencies out of the parsed AST body nodes
            if (Array.isArray(ast.body)) {
              ast.body.forEach((node) => {
                if (node.type === "ImportDeclaration" && node.source) {
                  const relativeImport = node.source.value;
                  try {
                    const resolvedImportPath = path.resolve(
                      path.dirname(fullPath),
                      relativeImport,
                    );
                    engine.registerDependency(fullPath, resolvedImportPath);
                  } catch (e) {}
                }
              });
            }

            // Evaluate Compliance Checks against the parsed code layout structure
            complianceEvaluator.evaluateFileAST(fullPath, ast, content);
          } catch (err) {
            // Structural or parsing error containment
          }
        }
      }
    }
  }

  await traverseDirectory(targetWorkspace);

  // Build outputs
  const cycles = engine.findCycles();

  const auditReport = {
    reconciledMetrics: {
      totalFiles: engine.totalFiles,
      totalLines: engine.totalLines,
      extensionBreakdown: engine.extensionCounts,
    },
    architecturalCyclesCount: cycles.length,
    detectedCycles: cycles,
    complianceFindings: complianceEvaluator.findings,
  };

  // Output dry-run remediation patches where applicable to direct files
  complianceEvaluator.findings.forEach((finding, idx) => {
    if (finding.rule.autoFixable) {
      const patchPath = `${finding.filePath}.patch-fix`;
      try {
        fs.writeFileSync(patchPath, finding.suggestedPatchFileContent);
      } catch (e) {}
    }
  });

  return auditReport;
}
