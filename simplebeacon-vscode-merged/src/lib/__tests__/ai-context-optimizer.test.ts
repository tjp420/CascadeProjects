import {
  AiContextOptimizer,
  AiContextOptimizeOptions,
  optimizeAiContext,
  prepareScanContextForModel,
} from "../ai-context-optimizer";

const mockSettings: AiContextOptimizeOptions = {
  shaveRedundantComments: true,
  compressMarkdownFences: true,
  stripAiBoilerplate: true,
  injectStructuralAnchors: true,
  maxInputChars: 1000,
};

describe("AiContextOptimizer", () => {
  it("shaves block comments, wraps anchors, and keeps executable code", () => {
    const optimizer = new AiContextOptimizer(mockSettings);
    const mockFileContent = `
            // This is a redundant inline comment that must be shaved
            function computeClearance() {
                /* Redundant block documentation */
                return true;
            }
        `;
    const result = optimizer.optimize(
      "test-file.ts",
      mockFileContent,
      " - file1.ts\n - file2.ts",
    );

    expect(result.payload.includes("Redundant block documentation")).toBe(false);
    expect(result.payload.includes("SIMPLEBEACON CONTEXT ANCHOR: START")).toBe(
      true,
    );
    expect(result.payload.includes("TARGET FILE: test-file.ts")).toBe(true);
    expect(result.payload.includes("computeClearance")).toBe(true);
    expect(result.shavedBytes).toBeGreaterThan(0);
  });

  it("keeps simplebeacon-ignore comments", () => {
    const src = `// simplebeacon-ignore: keep-this\nconst x = 1;\n`;
    const result = optimizeAiContext("keep.ts", src);
    expect(result.payload).toContain("simplebeacon-ignore: keep-this");
    expect(result.payload).toContain("const x = 1;");
  });

  it("does not write a tokenizer savings field", () => {
    const result = optimizeAiContext("a.ts", "const a = 1;");
    expect("originalTokenCountEstimate" in result).toBe(false);
  });

  it("prepareScanContextForModel skips comment shaving on markdown", () => {
    const md = "## Notes\n// keep this line in scan markdown\n";
    const out = prepareScanContextForModel(md, "/proj");
    expect(out).toContain("// keep this line in scan markdown");
    expect(out).toContain("SIMPLEBEACON CONTEXT ANCHOR: START");
  });
});
