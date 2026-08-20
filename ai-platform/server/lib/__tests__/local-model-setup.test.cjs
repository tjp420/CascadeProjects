"use strict";

/**
 * Local Model Setup Configuration Tests
 *
 * Verifies that:
 *  - The model manifest is valid JSON with expected structure
 *  - All Modelfiles referenced in the manifest exist on disk
 *  - All Modelfiles contain PARAMETER num_ctx (the critical fix)
 *  - All Modelfiles contain PARAMETER num_predict (output token cap)
 *  - All Modelfiles contain PARAMETER temperature (deterministic analysis)
 *  - The setup script exists and is executable
 *  - The auto-processor sends num_ctx in Ollama options
 *  - The ollama-client sends num_ctx in Ollama options
 *  - Context window values in manifest match context-window-chunker defaults
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const MODELS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "coming-soon",
  "public",
  "models",
);
const MANIFEST_PATH = path.join(MODELS_DIR, "manifest.json");
const SETUP_SCRIPT = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "scripts",
  "setup-local-model.cjs",
);
const AUTO_PROCESSOR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "auto-processor.js",
);
const OLLAMA_CLIENT = path.resolve(
  __dirname,
  "..",
  "..",
  "services",
  "ollama-client.cjs",
);
const CHUNKER_PATH = path.resolve(
  __dirname,
  "..",
  "context-window-chunker.cjs",
);

// ── Manifest validation ───────────────────────────────────────────────────

describe("Model manifest", () => {
  it("manifest.json exists and is valid JSON", () => {
    assert.ok(fs.existsSync(MANIFEST_PATH), "manifest.json should exist");
    const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
    assert.doesNotThrow(
      () => JSON.parse(raw),
      "manifest.json should be valid JSON",
    );
  });

  it("has expected top-level structure", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    assert.ok(typeof manifest.version === "number");
    assert.ok(typeof manifest.defaultModel === "string");
    assert.ok(typeof manifest.models === "object");
    assert.ok(
      Object.keys(manifest.models).length >= 3,
      "should have at least 3 models",
    );
  });

  it("each model has required fields", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    for (const [id, config] of Object.entries(manifest.models)) {
      assert.ok(config.modelfile, `model ${id} should have modelfile path`);
      assert.ok(config.ollamaModel, `model ${id} should have ollamaModel name`);
      assert.ok(
        typeof config.contextWindow === "number",
        `model ${id} should have numeric contextWindow`,
      );
      assert.ok(
        config.contextWindow > 0,
        `model ${id} contextWindow should be positive`,
      );
      assert.ok(
        typeof config.numPredict === "number",
        `model ${id} should have numeric numPredict`,
      );
      assert.ok(config.description, `model ${id} should have description`);
    }
  });

  it("default model exists in models map", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    assert.ok(
      manifest.models[manifest.defaultModel],
      "default model should exist in models map",
    );
  });

  it("includes envVars documentation", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    assert.ok(manifest.envVars, "should have envVars section");
    assert.ok(
      manifest.envVars.OLLAMA_BASE_URL,
      "should document OLLAMA_BASE_URL",
    );
    assert.ok(manifest.envVars.OLLAMA_MODEL, "should document OLLAMA_MODEL");
    assert.ok(
      manifest.envVars.OLLAMA_NUM_CTX,
      "should document OLLAMA_NUM_CTX",
    );
  });
});

// ── Modelfile validation ──────────────────────────────────────────────────

describe("Modelfiles", () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

  for (const [modelId, config] of Object.entries(manifest.models)) {
    const modelfilePath = path.join(MODELS_DIR, config.modelfile);

    it(`${modelId}: Modelfile exists at ${config.modelfile}`, () => {
      assert.ok(
        fs.existsSync(modelfilePath),
        `Modelfile should exist: ${modelfilePath}`,
      );
    });

    it(`${modelId}: Modelfile contains PARAMETER num_ctx`, () => {
      const content = fs.readFileSync(modelfilePath, "utf8");
      assert.ok(
        /PARAMETER\s+num_ctx\s+\d+/i.test(content),
        "Modelfile must set PARAMETER num_ctx",
      );
    });

    it(`${modelId}: Modelfile num_ctx matches manifest contextWindow`, () => {
      const content = fs.readFileSync(modelfilePath, "utf8");
      const match = content.match(/PARAMETER\s+num_ctx\s+(\d+)/i);
      assert.ok(match, "Modelfile must contain num_ctx");
      const modelfileCtx = parseInt(match[1], 10);
      assert.strictEqual(
        modelfileCtx,
        config.contextWindow,
        `Modelfile num_ctx (${modelfileCtx}) should match manifest contextWindow (${config.contextWindow})`,
      );
    });

    it(`${modelId}: Modelfile contains PARAMETER num_predict`, () => {
      const content = fs.readFileSync(modelfilePath, "utf8");
      assert.ok(
        /PARAMETER\s+num_predict\s+\d+/i.test(content),
        "Modelfile must set PARAMETER num_predict",
      );
    });

    it(`${modelId}: Modelfile contains PARAMETER temperature`, () => {
      const content = fs.readFileSync(modelfilePath, "utf8");
      assert.ok(
        /PARAMETER\s+temperature\s+[\d.]+/i.test(content),
        "Modelfile must set PARAMETER temperature",
      );
    });

    it(`${modelId}: Modelfile contains SYSTEM prompt`, () => {
      const content = fs.readFileSync(modelfilePath, "utf8");
      assert.ok(
        /^SYSTEM\s+/m.test(content),
        "Modelfile must have a SYSTEM prompt",
      );
    });

    it(`${modelId}: Modelfile contains FROM directive`, () => {
      const content = fs.readFileSync(modelfilePath, "utf8");
      assert.ok(
        /^FROM\s+/m.test(content),
        "Modelfile must have a FROM directive",
      );
    });
  }
});

// ── Setup script validation ───────────────────────────────────────────────

describe("Setup script", () => {
  it("setup-local-model.cjs exists", () => {
    assert.ok(fs.existsSync(SETUP_SCRIPT), "setup script should exist");
  });

  it("setup script is valid JavaScript", () => {
    const { spawnSync } = require("child_process");
    const result = spawnSync(process.execPath, ["--check", SETUP_SCRIPT], {
      stdio: "pipe",
    });
    assert.strictEqual(
      result.status,
      0,
      `setup script should be valid JS: ${result.stderr?.toString() || ""}`,
    );
  });

  it("setup script references manifest.json", () => {
    const content = fs.readFileSync(SETUP_SCRIPT, "utf8");
    assert.ok(
      content.includes("manifest.json"),
      "setup script should reference manifest.json",
    );
  });

  it("setup script supports --list, --verify, --model, --help", () => {
    const content = fs.readFileSync(SETUP_SCRIPT, "utf8");
    assert.ok(content.includes("--list"), "should support --list");
    assert.ok(content.includes("--verify"), "should support --verify");
    assert.ok(content.includes("--model"), "should support --model");
    assert.ok(content.includes("--help"), "should support --help");
  });
});

// ── Auto-processor num_ctx validation ─────────────────────────────────────

describe("auto-processor.js num_ctx", () => {
  it("reads OLLAMA_NUM_CTX from environment", () => {
    const content = fs.readFileSync(AUTO_PROCESSOR, "utf8");
    assert.ok(
      content.includes("OLLAMA_NUM_CTX"),
      "auto-processor should read OLLAMA_NUM_CTX env var",
    );
  });

  it("sends num_ctx in Ollama options", () => {
    const content = fs.readFileSync(AUTO_PROCESSOR, "utf8");
    assert.ok(
      /num_ctx\s*:/.test(content),
      "auto-processor should send num_ctx in options",
    );
  });

  it("defaults num_ctx to 8192 when env var not set", () => {
    const content = fs.readFileSync(AUTO_PROCESSOR, "utf8");
    assert.ok(
      /OLLAMA_NUM_CTX.*8192/.test(content),
      "should default to 8192 tokens",
    );
  });

  it("sends repeat_penalty in Ollama options", () => {
    const content = fs.readFileSync(AUTO_PROCESSOR, "utf8");
    assert.ok(
      /repeat_penalty\s*:/.test(content),
      "should send repeat_penalty in options",
    );
  });
});

// ── Ollama client num_ctx validation ──────────────────────────────────────

describe("ollama-client.cjs num_ctx", () => {
  it("reads OLLAMA_NUM_CTX from environment", () => {
    const content = fs.readFileSync(OLLAMA_CLIENT, "utf8");
    assert.ok(
      content.includes("OLLAMA_NUM_CTX"),
      "ollama-client should read OLLAMA_NUM_CTX env var",
    );
  });

  it("sends num_ctx in ollamaGenerate options", () => {
    const content = fs.readFileSync(OLLAMA_CLIENT, "utf8");
    assert.ok(
      /num_ctx\s*:/.test(content),
      "ollama-client should send num_ctx in options",
    );
  });

  it("defaults num_ctx to 8192 when env var not set", () => {
    const content = fs.readFileSync(OLLAMA_CLIENT, "utf8");
    assert.ok(
      /DEFAULT_NUM_CTX.*8192/.test(content),
      "should default to 8192 tokens",
    );
  });

  it("sends repeat_penalty in ollamaGenerate options", () => {
    const content = fs.readFileSync(OLLAMA_CLIENT, "utf8");
    assert.ok(
      /repeat_penalty\s*:/.test(content),
      "should send repeat_penalty in options",
    );
  });

  it("allows numCtx override via options parameter", () => {
    const content = fs.readFileSync(OLLAMA_CLIENT, "utf8");
    assert.ok(
      /options\.numCtx/.test(content),
      "should allow numCtx override via options",
    );
  });
});

// ── Context window alignment ──────────────────────────────────────────────

describe("Context window alignment with chunker", () => {
  const { DEFAULT_CONTEXT_WINDOWS } = require(CHUNKER_PATH);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

  it("unbreakable-oracle context window matches chunker default", () => {
    const manifestCtx = manifest.models["unbreakable-oracle"].contextWindow;
    const chunkerCtx =
      DEFAULT_CONTEXT_WINDOWS["unbreakable-oracle"] ||
      DEFAULT_CONTEXT_WINDOWS["unbreakable-oracle:latest"];
    assert.strictEqual(
      manifestCtx,
      chunkerCtx,
      `manifest contextWindow (${manifestCtx}) should match chunker default (${chunkerCtx})`,
    );
  });

  it("simplebeacon-llama32 context window matches chunker llama3.2 default", () => {
    const manifestCtx = manifest.models["simplebeacon-llama32"].contextWindow;
    const chunkerCtx = DEFAULT_CONTEXT_WINDOWS["llama3.2"];
    assert.strictEqual(
      manifestCtx,
      chunkerCtx,
      `manifest contextWindow (${manifestCtx}) should match chunker llama3.2 default (${chunkerCtx})`,
    );
  });

  it("simplebeacon-mistral context window matches chunker mistral default", () => {
    const manifestCtx = manifest.models["simplebeacon-mistral"].contextWindow;
    const chunkerCtx = DEFAULT_CONTEXT_WINDOWS["mistral"];
    assert.strictEqual(
      manifestCtx,
      chunkerCtx,
      `manifest contextWindow (${manifestCtx}) should match chunker mistral default (${chunkerCtx})`,
    );
  });

  it("simplebeacon-qwen-coder context window matches chunker qwen2.5-coder default", () => {
    const manifestCtx =
      manifest.models["simplebeacon-qwen-coder"].contextWindow;
    const chunkerCtx = DEFAULT_CONTEXT_WINDOWS["qwen2.5-coder"];
    assert.strictEqual(
      manifestCtx,
      chunkerCtx,
      `manifest contextWindow (${manifestCtx}) should match chunker qwen2.5-coder default (${chunkerCtx})`,
    );
  });
});
