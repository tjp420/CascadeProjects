// simplebeacon-ignore test-coverage
/**
 * Layer 2 — semantic / intent analysis (deterministic + optional LLM).
 */

const {
  createLanguageDetector,
} = require("../universal-language-detector.cjs");
const {
  detectBusinessLogicPatterns,
} = require("./business-logic-patterns.cjs");
const constants = require("../../config/constants.cjs");
const {
  explainCodeWithProvider,
  providerConfigured,
} = require("../../services/cloud-inference-service.cjs");

const detector = createLanguageDetector();

const INTENT_TEMPLATES = {
  zscript: {
    actor:
      "Defines or extends a game actor (GZDoom ZScript) — likely gameplay entity behavior.",
    weapon: "Implements weapon or combat interaction logic for a mod.",
    state: "Controls animation/state transitions during actor lifecycle.",
    debug:
      "Contains developer-only diagnostics that should be removed before release.",
  },
  javascript: {
    api: "Exposes or handles HTTP/API behavior for the application.",
    auth: "Manages authentication, sessions, or access control.",
    test: "Validates behavior through automated tests.",
    config: "Configures runtime behavior or environment.",
  },
};

/**
 * Classify purpose.
 * @param {any} content
 * @param {any} language
 * @param {any} businessLogic
 * @param {string} filePath
 * @returns {any}
 */
function classifyPurpose(content, language, businessLogic, filePath) {
  const rel = String(filePath || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  const purposes = [];

  if (language === "zscript" || /\.zs$|zscript/.test(rel)) {
    if (/\bclass\s+\w+\s*:\s*(Weapon|CustomInventory)/.test(content))
      purposes.push("weapon");
    if (/\bclass\s+\w+\s*:\s*Actor/.test(content)) purposes.push("actor");
    if (/\bStates\s*\{/.test(content)) purposes.push("state");
    if (/\b(Console\.Command|A_Log|DEVONLY)\b/.test(content))
      purposes.push("debug");
  }

  if (/\.test\.|\.spec\.|\/tests\//.test(rel)) purposes.push("test");
  if (/server\/|routes\/|api\//.test(rel)) purposes.push("api");
  if (/auth|login|jwt/.test(rel)) purposes.push("auth");
  if (/config|\.env/.test(rel)) purposes.push("config");

  const templates = INTENT_TEMPLATES[language] || INTENT_TEMPLATES.javascript;
  const statements = purposes
    .filter((p) => templates[p])
    .map((p) => templates[p]);

  if (!statements.length && businessLogic.primaryDomain) {
    statements.push(
      `Appears to implement ${businessLogic.primaryDomain.replace(/-/g, " ")} domain logic.`,
    );
  }

  if (!statements.length) {
    statements.push(
      "General-purpose code module — purpose inferred from structure and path only.",
    );
  }

  return {
    tags: purposes,
    summary: statements.slice(0, 4).join(" "),
    confidence: purposes.length ? 0.72 : 0.45,
  };
}

/**
 * Assess assumptions.
 * @param {any} content
 * @param {any} language
 * @returns {any}
 */
function assessAssumptions(content, language) {
  const assumptions = [];
  if (/\bprocess\.env\./.test(content)) {
    assumptions.push("Relies on environment variables at runtime.");
  }
  if (/\b(localhost|127\.0\.0\.1)\b/i.test(content)) {
    assumptions.push("References local development hosts.");
  }
  if (language === "zscript" && /\bversion\s*["']\s*4\./.test(content)) {
    assumptions.push(
      "Uses GZDoom 4.x+ ZScript features — requires compatible engine version.",
    );
  }
  if (/\bTODO\b|\bFIXME\b|\bHACK\b/.test(content)) {
    assumptions.push("Contains unfinished work markers (TODO/FIXME/HACK).");
  }
  return assumptions.slice(0, 6);
}

/**
 * Analyze semantic layer.
 * @param {any} content
 * @param {string} context
 * @param {Object} options
 * @returns {any}
 */
async function analyzeSemanticLayer(content, context = {}, options = {}) {
  const filePath = context.filePath || "";
  const detection =
    context.languageDetection ||
    detector.detectLanguage(filePath || "snippet.txt", content);
  const language = detection.language || "generic";

  const businessLogic = detectBusinessLogicPatterns(content, {
    language,
    filePath,
    domainHints: context.domainHints,
  });

  const intent = classifyPurpose(content, language, businessLogic, filePath);
  const assumptions = assessAssumptions(content, language);

  const result = {
    layer: "semantic",
    language,
    languageConfidence: detection.confidence ?? null,
    detectionMethod: detection.method || null,
    purpose: intent.summary,
    purposeTags: intent.tags,
    purposeConfidence: intent.confidence,
    businessLogic,
    assumptions,
    aiEnhanced: false,
    aiSummary: null,
    aiError: null,
  };

  const mode = String(options.mode || "deterministic").toLowerCase();
  const aiProvider = String(options.aiProvider || "demo").toLowerCase();

  if (
    mode === "llm" &&
    aiProvider !== "demo" &&
    providerConfigured(aiProvider, options.registry, options.userCredentials)
  ) {
    try {
      const ai = await explainCodeWithProvider(
        aiProvider,
        {
          code: content.slice(0, constants.TIMEOUT_12S),
          filePath,
          language,
          purpose: intent.summary,
          businessDomains: businessLogic.domains,
          assumptions,
          staticFindings: (context.staticFindings || []).slice(0, 12),
        },
        options,
      );
      if (ai.enhanced && ai.explanation) {
        result.aiEnhanced = true;
        result.aiSummary = ai.explanation;
        result.aiProvider = aiProvider;
      }
    } catch (error) {
      result.aiError = error.message;
    }
  }

  return result;
}

module.exports = {
  analyzeSemanticLayer,
  classifyPurpose,
  assessAssumptions,
};
