"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { UniversalContextProxy } = require("../universal-proxy.cjs");

describe("Universal Context Transformer Safety Bounds", () => {
  it("preserves non-string content structures (array / multimodal)", () => {
    const transformer = new UniversalContextProxy({ optInGraph: false });
    const payload = {
      model: "gpt-5-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64,qq" },
            },
          ],
        },
      ],
      temperature: 0.2,
      tools: [{ type: "function", function: { name: "scan" } }],
    };

    const { optimizedBody } = transformer.optimizeRequest(payload);

    assert.deepStrictEqual(
      optimizedBody.messages[0].content,
      payload.messages[0].content,
    );
    assert.strictEqual(optimizedBody.temperature, 0.2);
    assert.deepStrictEqual(optimizedBody.tools, payload.tools);
  });

  it("does not inject a graph unless optInGraph is true", () => {
    const transformer = new UniversalContextProxy({ optInGraph: false });
    const payload = {
      messages: [{ role: "user", content: "Scan this code block" }],
    };
    const { optimizedBody, metrics } = transformer.optimizeRequest(
      payload,
      " - src/a.cjs\n - src/b.cjs",
    );
    assert.equal(
      optimizedBody.messages[0].content.includes("WORKSPACE ANALYSIS"),
      false,
    );
    assert.equal(metrics.graphInjected, false);
  });

  it("enforces max graph size and labels overrun", () => {
    const transformer = new UniversalContextProxy({
      optInGraph: true,
      maxGraphSizeBytes: 20,
    });
    const payload = {
      messages: [{ role: "user", content: "Scan this code block" }],
    };
    const massiveGraph =
      "A_VERY_LONG_STRUCTURAL_WORKSPACE_TREE_MAP_DATA_STRING";

    const { optimizedBody, metrics } = transformer.optimizeRequest(
      payload,
      massiveGraph,
    );

    assert.match(
      optimizedBody.messages[0].content,
      /Graph Truncated Due to Context Budget Overrun/,
    );
    assert.equal(metrics.graphTruncated, true);
    assert.equal(metrics.graphInjected, true);
  });

  it("keeps code comments and collapses extra blank lines", () => {
    const transformer = new UniversalContextProxy({ optInGraph: false });
    const payload = {
      messages: [
        {
          role: "user",
          content:
            "  function init() {\n\n\n    // Keep this comment instruction\n    return true;\n  }  ",
        },
      ],
    };

    const { optimizedBody } = transformer.optimizeRequest(payload);
    const resultText = optimizedBody.messages[0].content;

    assert.match(resultText, /\/\/ Keep this comment instruction/);
    assert.equal(resultText.includes("\n\n\n"), false);
  });

  it("clones unknown request fields without reading env credentials", () => {
    const transformer = new UniversalContextProxy();
    const payload = {
      messages: [{ role: "user", content: "hello" }],
      vendorMeta: "passthrough-field",
    };
    const { optimizedBody } = transformer.optimizeRequest(payload);
    assert.equal(optimizedBody.vendorMeta, "passthrough-field");
  });

  it("labels token savings as an estimate and reports bytes", () => {
    const transformer = new UniversalContextProxy({ optInGraph: false });
    const { metrics } = transformer.optimizeRequest({
      messages: [{ role: "user", content: "a\n\n\n\nb" }],
    });
    assert.equal(typeof metrics.savedBytes, "number");
    assert.equal(typeof metrics.tokenEstimateSaved, "number");
    assert.ok(!("guaranteedTokenReduction" in metrics));
  });

  it("shrinks injected graph to stay within maxContextBytes", () => {
    const transformer = new UniversalContextProxy({
      optInGraph: true,
      maxGraphSizeBytes: 5000,
      maxContextBytes: 80,
    });
    const payload = {
      messages: [{ role: "user", content: "ok" }],
    };
    const { optimizedBody, metrics } = transformer.optimizeRequest(
      payload,
      "x".repeat(4000),
    );
    assert.ok(
      Buffer.byteLength(optimizedBody.messages[0].content, "utf8") <= 80,
    );
    assert.equal(metrics.graphTruncated, true);
  });
});
