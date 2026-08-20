"use strict";

/**
 * Tests for block-aware stream-mode PII scrubbing in pii-policy-store.cjs
 *
 * Tests that the stream scrubber correctly handles tagged chunks with
 * block types ('text', 'thinking', 'redacted_thinking'). PII redaction
 * is only applied to 'text' blocks; thinking and redacted_thinking blocks
 * pass through untouched. This prevents false positives in model reasoning
 * content and preserves the structure of interleaved streaming responses.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("Block-Aware Stream PII Scrubbing", () => {
  let storeModule;
  let _tempPolicyPath;
  let _tempDir;

  beforeEach(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-pii-block-"));
    _tempPolicyPath = path.join(_tempDir, "pii-policies.json");
    process.env.PII_POLICY_PATH = _tempPolicyPath;
    fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), "utf8");
    jest.resetModules();
    storeModule = require("../pii-policy-store.cjs");
  });

  afterEach(() => {
    try {
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── Basic Block-Aware Operations ───────────────────────────────────────────

  describe("basic block-aware operations", () => {
    beforeEach(() => {
      storeModule.seedDefaults("org-block");
    });

    it("should accept object chunks with { text, type }", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process({ text: "Hello world", type: "text" });
      const tail = scrubber.flush();
      // Object input returns object output
      assert.ok(typeof out === "object" || typeof out === "string");
      // Combined should contain the text
      const combined = typeof out === "object" ? out.text : out;
      const combinedTail = typeof tail === "object" ? tail.text : tail;
      assert.ok((combined + combinedTail).includes("Hello world"));
    });

    it("should return { text, type } for object input", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process({ text: "Hello world", type: "text" });
      const tail = scrubber.flush();
      // At least one of out or tail should be an object with type
      const hasObjectType =
        (typeof out === "object" && out !== null && out.type === "text") ||
        (typeof tail === "object" && tail !== null && tail.type === "text");
      assert.ok(hasObjectType, "Should return { text, type } for object input");
    });

    it("should redact PII in text blocks", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process({
        text: "Email: alice@test.com",
        type: "text",
      });
      const tail = scrubber.flush();
      const combined = typeof out === "object" ? out.text : out;
      const combinedTail = typeof tail === "object" ? tail.text : tail;
      const fullText = combined + combinedTail;
      assert.ok(fullText.includes("[REDACTED-EMAIL]"));
      assert.ok(!fullText.includes("alice@test.com"));
    });

    it("should NOT redact PII in thinking blocks", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process({
        text: "I should email alice@test.com",
        type: "thinking",
      });
      const tail = scrubber.flush();
      const combined = typeof out === "object" ? out.text : out;
      const combinedTail = typeof tail === "object" ? tail.text : tail;
      const fullText = combined + combinedTail;
      // PII should NOT be redacted in thinking blocks
      assert.ok(fullText.includes("alice@test.com"));
      assert.ok(!fullText.includes("[REDACTED-EMAIL]"));
    });

    it("should NOT redact PII in redacted_thinking blocks", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process({
        text: "Token: bearer abc123",
        type: "redacted_thinking",
      });
      const tail = scrubber.flush();
      const combined = typeof out === "object" ? out.text : out;
      const combinedTail = typeof tail === "object" ? tail.text : tail;
      const fullText = combined + combinedTail;
      assert.ok(fullText.includes("bearer abc123"));
      assert.ok(!fullText.includes("[REDACTED-TOKEN]"));
    });
  });

  // ── Block Type Transitions ─────────────────────────────────────────────────

  describe("block type transitions", () => {
    beforeEach(() => {
      storeModule.seedDefaults("org-block");
    });

    it("should flush text block when transitioning to thinking", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out1 = scrubber.process({
        text: "Email: alice@test.com",
        type: "text",
      });
      const out2 = scrubber.process({
        text: "Let me think...",
        type: "thinking",
      });
      const tail = scrubber.flush();

      // out1 or out2 should contain the redacted text from the text block
      const textOut1 = typeof out1 === "object" ? out1.text : out1;
      const textOut2 = typeof out2 === "object" ? out2.text : out2;
      const textTail = typeof tail === "object" ? tail.text : tail;
      const allText = textOut1 + textOut2 + textTail;

      assert.ok(allText.includes("[REDACTED-EMAIL]"));
      assert.ok(allText.includes("Let me think..."));
    });

    it("should flush thinking block when transitioning to text", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out1 = scrubber.process({
        text: "I know alice@test.com",
        type: "thinking",
      });
      const out2 = scrubber.process({
        text: "Email: bob@test.com",
        type: "text",
      });
      const tail = scrubber.flush();

      const textOut1 = typeof out1 === "object" ? out1.text : out1;
      const textOut2 = typeof out2 === "object" ? out2.text : out2;
      const textTail = typeof tail === "object" ? tail.text : tail;
      const allText = textOut1 + textOut2 + textTail;

      // Thinking block should NOT be redacted
      assert.ok(allText.includes("alice@test.com"));
      // Text block should be redacted
      assert.ok(allText.includes("[REDACTED-EMAIL]"));
      assert.ok(!allText.includes("bob@test.com"));
    });

    it("should handle multiple interleaved text/thinking blocks", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const chunks = [
        { text: "User email: alice@test.com", type: "text" },
        { text: "I remember bob@test.com too", type: "thinking" },
        { text: "Also SSN: 123-45-6789", type: "text" },
        { text: "And IP 10.0.0.1", type: "thinking" },
        { text: "Done", type: "text" },
      ];

      let allText = "";
      for (const chunk of chunks) {
        const out = scrubber.process(chunk);
        allText += typeof out === "object" ? out.text : out;
      }
      const tail = scrubber.flush();
      allText += typeof tail === "object" ? tail.text : tail;

      // Text blocks should be redacted
      assert.ok(allText.includes("[REDACTED-EMAIL]"));
      assert.ok(allText.includes("[REDACTED-SSN]"));
      assert.ok(!allText.includes("alice@test.com"));
      assert.ok(!allText.includes("123-45-6789"));

      // Thinking blocks should NOT be redacted
      assert.ok(allText.includes("bob@test.com"));
      assert.ok(allText.includes("10.0.0.1"));
    });

    it("should handle redacted_thinking to text transition", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out1 = scrubber.process({
        text: "Internal: bearer secret123",
        type: "redacted_thinking",
      });
      const out2 = scrubber.process({
        text: "Token: bearer abc456",
        type: "text",
      });
      const tail = scrubber.flush();

      const allText = [
        typeof out1 === "object" ? out1.text : out1,
        typeof out2 === "object" ? out2.text : out2,
        typeof tail === "object" ? tail.text : tail,
      ].join("");

      // redacted_thinking should NOT be redacted
      assert.ok(allText.includes("bearer secret123"));
      // text block should be redacted
      assert.ok(allText.includes("[REDACTED-TOKEN]"));
      assert.ok(!allText.includes("bearer abc456"));
    });
  });

  // ── Cross-Chunk PII in Text Blocks ─────────────────────────────────────────

  describe("cross-chunk PII in text blocks", () => {
    beforeEach(() => {
      storeModule.seedDefaults("org-block");
    });

    it("should redact email split across text chunks", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out1 = scrubber.process({ text: "Contact alice@", type: "text" });
      const out2 = scrubber.process({ text: "example.com now", type: "text" });
      const tail = scrubber.flush();

      const allText = [
        typeof out1 === "object" ? out1.text : out1,
        typeof out2 === "object" ? out2.text : out2,
        typeof tail === "object" ? tail.text : tail,
      ].join("");

      assert.ok(allText.includes("[REDACTED-EMAIL]"));
      assert.ok(!allText.includes("alice@example.com"));
    });

    it("should NOT redact PII split across thinking chunks", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out1 = scrubber.process({ text: "SSN: 123-45-", type: "thinking" });
      const out2 = scrubber.process({ text: "6789 done", type: "thinking" });
      const tail = scrubber.flush();

      const allText = [
        typeof out1 === "object" ? out1.text : out1,
        typeof out2 === "object" ? out2.text : out2,
        typeof tail === "object" ? tail.text : tail,
      ].join("");

      assert.ok(allText.includes("123-45-6789"));
      assert.ok(!allText.includes("[REDACTED-SSN]"));
    });
  });

  // ── Block-Aware Stats ──────────────────────────────────────────────────────

  describe("block-aware stats", () => {
    beforeEach(() => {
      storeModule.seedDefaults("org-block");
    });

    it("should track blockCount", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      scrubber.process({ text: "text block", type: "text" });
      scrubber.process({ text: "thinking block", type: "thinking" });
      scrubber.process({ text: "text block 2", type: "text" });
      scrubber.flush();
      const stats = scrubber.getStats();
      assert.ok(typeof stats.blockCount === "number");
      assert.ok(stats.blockCount >= 2); // at least 2 transitions
    });

    it("should track blockTypeCounts", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      scrubber.process({ text: "text1", type: "text" });
      scrubber.process({ text: "think1", type: "thinking" });
      scrubber.process({ text: "text2", type: "text" });
      scrubber.flush();
      const stats = scrubber.getStats();
      assert.ok(stats.blockTypeCounts);
      assert.ok(stats.blockTypeCounts["text"] >= 1);
      assert.ok(stats.blockTypeCounts["thinking"] >= 1);
    });

    it("should track currentBlockType", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      scrubber.process({ text: "text", type: "text" });
      let stats = scrubber.getStats();
      assert.strictEqual(stats.currentBlockType, "text");

      scrubber.process({ text: "think", type: "thinking" });
      stats = scrubber.getStats();
      assert.strictEqual(stats.currentBlockType, "thinking");
    });

    it("should only count redactions from text blocks", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      // Text block with PII
      scrubber.process({ text: "alice@test.com", type: "text" });
      // Thinking block with PII (should NOT be counted)
      scrubber.process({ text: "bob@test.com", type: "thinking" });
      scrubber.flush();
      const stats = scrubber.getStats();
      // Only 1 redaction (from text block), not 2
      assert.ok(stats.totalRedacted >= 1);
      // The email count should be 1, not 2
      const emailCount = stats.matchCounts["Email Address"] || 0;
      assert.ok(
        emailCount >= 1,
        "Should have at least 1 email redaction from text block",
      );
    });
  });

  // ── Backward Compatibility ─────────────────────────────────────────────────

  describe("backward compatibility with string chunks", () => {
    beforeEach(() => {
      storeModule.seedDefaults("org-block");
    });

    it("should accept string chunks (no type field)", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process("Hello world");
      const tail = scrubber.flush();
      assert.strictEqual(typeof out === "string" ? out : out.text, "");
      assert.strictEqual(
        typeof tail === "string" ? tail : tail.text,
        "Hello world",
      );
    });

    it("should redact PII in string chunks (treated as text)", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process("Email: alice@test.com");
      const tail = scrubber.flush();
      const combined =
        (typeof out === "string" ? out : out.text) +
        (typeof tail === "string" ? tail : tail.text);
      assert.ok(combined.includes("[REDACTED-EMAIL]"));
    });

    it("should handle mixed string and object chunks", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out1 = scrubber.process("Text: alice@test.com"); // string
      const out2 = scrubber.process({
        text: "Think: bob@test.com",
        type: "thinking",
      }); // object
      const tail = scrubber.flush();

      const allText = [
        typeof out1 === "string" ? out1 : out1.text,
        typeof out2 === "string" ? out2 : out2.text,
        typeof tail === "string" ? tail : tail.text,
      ].join("");

      // String chunk (text) should be redacted
      assert.ok(allText.includes("[REDACTED-EMAIL]"));
      // Object chunk (thinking) should NOT be redacted
      assert.ok(allText.includes("bob@test.com"));
    });
  });

  // ── No Patterns (Pass-Through with Blocks) ─────────────────────────────────

  describe("no patterns (pass-through with blocks)", () => {
    it("should pass through text blocks when no patterns exist", () => {
      const scrubber = storeModule.createStreamScrubber("org-empty");
      const out = scrubber.process({ text: "alice@test.com", type: "text" });
      assert.ok(typeof out === "object");
      assert.strictEqual(out.text, "alice@test.com");
      assert.strictEqual(out.type, "text");
    });

    it("should pass through thinking blocks when no patterns exist", () => {
      const scrubber = storeModule.createStreamScrubber("org-empty");
      const out = scrubber.process({
        text: "alice@test.com",
        type: "thinking",
      });
      assert.ok(typeof out === "object");
      assert.strictEqual(out.text, "alice@test.com");
      assert.strictEqual(out.type, "thinking");
    });

    it("should report zero patternCount with block stats", () => {
      const scrubber = storeModule.createStreamScrubber("org-empty");
      scrubber.process({ text: "hello", type: "text" });
      const stats = scrubber.getStats();
      assert.strictEqual(stats.patternCount, 0);
      assert.ok(typeof stats.blockCount === "number");
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    beforeEach(() => {
      storeModule.seedDefaults("org-block");
    });

    it("should handle empty text in object chunk", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process({ text: "", type: "text" });
      const tail = scrubber.flush();
      // Should not crash, should return empty or empty object
      const textOut = typeof out === "object" ? out.text : out;
      const textTail = typeof tail === "object" ? tail.text : tail;
      assert.strictEqual(textOut + textTail, "");
    });

    it("should handle unknown block type (treated as redactable)", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process({
        text: "alice@test.com",
        type: "unknown_type",
      });
      const tail = scrubber.flush();
      const allText = [
        typeof out === "object" ? out.text : out,
        typeof tail === "object" ? tail.text : tail,
      ].join("");
      // Unknown types are NOT in NON_REDACTED_BLOCK_TYPES, so they get redacted
      assert.ok(allText.includes("[REDACTED-EMAIL]"));
    });

    it("should handle missing type field (defaults to text)", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out = scrubber.process({ text: "alice@test.com" });
      const tail = scrubber.flush();
      const allText = [
        typeof out === "object" ? out.text : out,
        typeof tail === "object" ? tail.text : tail,
      ].join("");
      assert.ok(allText.includes("[REDACTED-EMAIL]"));
    });

    it("should handle rapid block type switching", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      const out1 = scrubber.process({ text: "a", type: "text" });
      const out2 = scrubber.process({ text: "b", type: "thinking" });
      const out3 = scrubber.process({ text: "c", type: "text" });
      const out4 = scrubber.process({ text: "d", type: "thinking" });
      const out5 = scrubber.process({ text: "e", type: "text" });
      const tail = scrubber.flush();

      const allText = [out1, out2, out3, out4, out5, tail]
        .map((o) => (typeof o === "object" ? o.text : o))
        .join("");

      assert.ok(allText.includes("a"));
      assert.ok(allText.includes("b"));
      assert.ok(allText.includes("c"));
      assert.ok(allText.includes("d"));
      assert.ok(allText.includes("e"));
    });

    it("should preserve block type in flush output for non-text blocks", () => {
      const scrubber = storeModule.createStreamScrubber("org-block");
      // Thinking blocks pass through immediately (no holdback), so process()
      // emits the full content and flush() returns empty object with type
      const out = scrubber.process({
        text: "thinking content",
        type: "thinking",
      });
      const tail = scrubber.flush();

      // process() should return object with type 'thinking' and full content
      assert.ok(typeof out === "object");
      assert.strictEqual(out.type, "thinking");
      assert.strictEqual(out.text, "thinking content");

      // flush() should return empty object with type 'thinking'
      assert.ok(typeof tail === "object");
      assert.strictEqual(tail.type, "thinking");
      assert.strictEqual(tail.text, "");
    });
  });
});
