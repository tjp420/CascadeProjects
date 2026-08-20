import { describe, it } from "node:test";
import assert from "node:assert";

import * as intelligence from "../index.js";

describe("simplebeacon-intelligence/index.js", () => {
  it("exports IntelligenceEngine class", () => {
    assert.strictEqual(typeof intelligence.IntelligenceEngine, "function");
  });

  it("exports factory functions", () => {
    assert.strictEqual(
      typeof intelligence.createIntelligenceEngine,
      "function",
    );
    assert.strictEqual(typeof intelligence.getIntelligenceEngine, "function");
  });

  it("exports intent scanner functions", () => {
    assert.strictEqual(typeof intelligence.scanIntent, "function");
    assert.strictEqual(typeof intelligence.scanIntentAsync, "function");
    assert.strictEqual(typeof intelligence.resolveLanguage, "function");
    assert.strictEqual(typeof intelligence.isLanguageSupported, "function");
    assert.ok(intelligence.engine);
  });

  it("exports structural scanner functions", () => {
    assert.strictEqual(typeof intelligence.scanStructuralIntent, "function");
    assert.strictEqual(typeof intelligence.scanCredentialDictStubs, "function");
    assert.strictEqual(typeof intelligence.extractPythonFunctions, "function");
    assert.strictEqual(typeof intelligence.extractJsFunctions, "function");
    assert.strictEqual(typeof intelligence.analyzeFunctionBlock, "function");
    assert.strictEqual(typeof intelligence.isGenericName, "function");
    assert.strictEqual(typeof intelligence.credentialKeyMatch, "function");
    assert.strictEqual(
      typeof intelligence.isPlaceholderCredentialValue,
      "function",
    );
    assert.strictEqual(typeof intelligence.hasPlaceholderReturn, "function");
  });

  it("exports tree-sitter loader functions", () => {
    assert.ok(intelligence.GRAMMAR_MAP);
    assert.strictEqual(typeof intelligence.initParser, "function");
    assert.strictEqual(typeof intelligence.createLanguageParser, "function");
    assert.strictEqual(typeof intelligence.parseWithTreeSitter, "function");
    assert.strictEqual(typeof intelligence.isGrammarAvailable, "function");
    assert.strictEqual(typeof intelligence.getTreeSitterStatus, "function");
    assert.strictEqual(typeof intelligence.resolveWasmDir, "function");
  });

  it("exports SLM bridge functions", () => {
    assert.strictEqual(typeof intelligence.probeSlmBin, "function");
    assert.strictEqual(typeof intelligence.canRunSlm, "function");
    assert.strictEqual(typeof intelligence.buildSlmPrompt, "function");
    assert.strictEqual(typeof intelligence.parseSlmResponse, "function");
    assert.strictEqual(typeof intelligence.validateSlmResult, "function");
    assert.strictEqual(typeof intelligence.runSlmReview, "function");
    assert.strictEqual(typeof intelligence.runSlmReviewAsync, "function");
  });

  it("exports constants", () => {
    assert.ok(
      Array.isArray(intelligence.GENERIC_AI_MARKERS) ||
        intelligence.GENERIC_AI_MARKERS,
    );
    assert.ok(intelligence.CREDENTIAL_KEY_FRAGMENTS);
    assert.ok(intelligence.INTENT_RULE_IDS);
    assert.ok(intelligence.LANGUAGE_BY_EXT);
  });

  it("exports tree-sitter query functions", () => {
    assert.ok(intelligence.FUNCTION_NODE_TYPES);
    assert.strictEqual(
      typeof intelligence.extractFunctionsFromTree,
      "function",
    );
    assert.strictEqual(typeof intelligence.scanStructuralFromTree, "function");
    assert.strictEqual(typeof intelligence.scanWithTreeSitter, "function");
  });

  it("exports vector cache functions", () => {
    assert.strictEqual(typeof intelligence.loadFingerprints, "function");
    assert.strictEqual(typeof intelligence.extractFeatureVector, "function");
    assert.strictEqual(typeof intelligence.matchFingerprints, "function");
    assert.strictEqual(typeof intelligence.fingerprintFindings, "function");
    assert.strictEqual(typeof intelligence.cosineSimilarity, "function");
  });

  it("IntelligenceEngine can be instantiated", () => {
    const engine = new intelligence.IntelligenceEngine();
    assert.ok(engine);
    assert.strictEqual(typeof engine.scan, "function");
    assert.strictEqual(typeof engine.scanSync, "function");
    assert.strictEqual(typeof engine.canRunSlm, "function");
    assert.strictEqual(typeof engine.slmReview, "function");
    assert.strictEqual(typeof engine.slmReviewAsync, "function");
    assert.strictEqual(typeof engine.resolveLanguage, "function");
    assert.strictEqual(typeof engine.isLanguageSupported, "function");
    assert.strictEqual(typeof engine.getStatus, "function");
  });

  it("createIntelligenceEngine returns a new instance", () => {
    const e1 = intelligence.createIntelligenceEngine();
    const e2 = intelligence.createIntelligenceEngine();
    assert.ok(e1 instanceof intelligence.IntelligenceEngine);
    assert.ok(e2 instanceof intelligence.IntelligenceEngine);
    assert.notStrictEqual(e1, e2);
  });

  it("getIntelligenceEngine returns a singleton", () => {
    const e1 = intelligence.getIntelligenceEngine();
    const e2 = intelligence.getIntelligenceEngine();
    assert.ok(e1 instanceof intelligence.IntelligenceEngine);
    assert.strictEqual(e1, e2);
  });
});
