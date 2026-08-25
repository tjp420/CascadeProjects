"use strict";

jest.mock("../../services/cloud-inference-service.cjs", () => ({
  explainCodeWithProvider: jest.fn(),
  providerConfigured: jest.fn().mockReturnValue(false),
}));

const codeUnderstanding = require("../code-understanding/index.cjs");

describe("code-understanding/index", () => {
  test("exports frozen object with expected keys", () => {
    expect(Object.isFrozen(codeUnderstanding)).toBe(true);
    expect(typeof codeUnderstanding.understandCodeSnippet).toBe("function");
    expect(typeof codeUnderstanding.understandFile).toBe("function");
    expect(typeof codeUnderstanding.attachUnderstandingToCodebaseReport).toBe(
      "function",
    );
    expect(typeof codeUnderstanding.analyzeSemanticLayer).toBe("function");
    expect(typeof codeUnderstanding.analyzeContextualLayer).toBe("function");
    expect(typeof codeUnderstanding.appendExpertReview).toBe("function");
    expect(typeof codeUnderstanding.loadExpertReviews).toBe("function");
    expect(typeof codeUnderstanding.summarizeExpertConsensus).toBe("function");
    expect(typeof codeUnderstanding.detectBusinessLogicPatterns).toBe(
      "function",
    );
    expect(typeof codeUnderstanding.generateZscriptModReport).toBe("function");
  });
});
