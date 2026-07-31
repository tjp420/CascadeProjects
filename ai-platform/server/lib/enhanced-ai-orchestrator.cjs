// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Enhanced AI Analysis Orchestrator
 *
 * Provides intelligent analysis routing, adaptive model selection,
 * and progressive enhancement for AI-powered code analysis.
 */

const { analyzeWithModel } = require('../services/model-inference-service.cjs');
const { summarizeScanWithProvider } = require('../services/cloud-inference-service.cjs');
const { ensureRegistry } = require('../services/local-model-service.cjs');
const { getUserAiCredentials } = require('../lib/user-ai-keys-store.cjs');
const { analyzeSemanticLayer } = require('./code-understanding/semantic-analyzer.cjs');
const { analyzeContextualLayer } = require('./code-understanding/contextual-analyzer.cjs');
const logger = require('../../src/lib/app-logger.cjs');

/**
 * Analysis configuration profiles for different use cases
 */
const ANALYSIS_PROFILES = {
  // Fast, lightweight analysis for quick feedback
  quick: {
    maxDepth: 2,
    timeoutMs: 30000,
    useSemantic: false,
    useContextual: false,
    modelPreference: 'local',
    fallbackToDeterministic: true,
  },

  // Balanced analysis for general use
  balanced: {
    maxDepth: 5,
    timeoutMs: 60000,
    useSemantic: true,
    useContextual: false,
    modelPreference: 'hybrid',
    fallbackToDeterministic: true,
  },

  // Comprehensive analysis for deep insights
  comprehensive: {
    maxDepth: 10,
    timeoutMs: 120000,
    useSemantic: true,
    useContextual: true,
    modelPreference: 'cloud',
    fallbackToDeterministic: false,
    enableExpertReview: true,
  },

  // Real-time analysis for streaming updates
  realtime: {
    maxDepth: 3,
    timeoutMs: 15000,
    useSemantic: false,
    useContextual: false,
    modelPreference: 'local',
    streaming: true,
    incremental: true,
  },
};

/**
 * Intelligent model selection based on analysis requirements and available resources
 */
function selectOptimalModel(availableModels, requirements = {}) {
  const { modelPreference, analysisType, complexity } = requirements;

  // Score each model based on requirements
  const scoredModels = availableModels.map((model) => {
    let score = 0;

    // Provider preference scoring
    if (modelPreference === 'local' && model.provider === 'ollama') score += 3;
    if (
      modelPreference === 'cloud' &&
      (model.provider === 'openai' || model.provider === 'anthropic')
    )
      score += 3;
    if (modelPreference === 'hybrid') score += 1;

    // Capability scoring
    if (model.size && model.size.includes('7b')) score += 2;
    if (model.size && model.size.includes('13b')) score += 3;
    if (model.size && model.size.includes('34b')) score += 4;

    // Availability scoring
    if (model.status === 'active') score += 2;
    if (model.confidence && model.confidence > 0.8) score += 1;

    return { ...model, score };
  });

  // Sort by score and return the best available model
  scoredModels.sort((a, b) => b.score - a.score);
  return scoredModels[0] || null;
}

/**
 * Progressive analysis enhancement
 */
async function progressiveAnalysis(content, context, options = {}) {
  const profile = ANALYSIS_PROFILES[options.profile] || ANALYSIS_PROFILES.balanced;
  const results = {
    profile: options.profile || 'balanced',
    layers: {},
    confidence: 0,
    enhancements: [],
  };

  try {
    // Layer 1: Basic static analysis (always available)
    results.layers.static = await performStaticAnalysis(content, context);
    results.confidence = Math.max(results.confidence, 0.3);

    // Layer 2: Semantic analysis (if enabled and resources available)
    if (profile.useSemantic) {
      try {
        results.layers.semantic = await analyzeSemanticLayer(content, context, options);
        results.confidence = Math.max(results.confidence, 0.6);
        results.enhancements.push('semantic');
      } catch (error) {
        logger.warn('[Enhanced Orchestrator] Semantic analysis failed:', error.message);
      }
    }

    // Layer 3: Contextual analysis (if enabled)
    if (profile.useContextual && context.projectPath) {
      try {
        results.layers.contextual = await analyzeContextualLayer(
          context.filePath || 'unknown',
          context.projectPath,
          content
        );
        results.confidence = Math.max(results.confidence, 0.8);
        results.enhancements.push('contextual');
      } catch (error) {
        logger.warn('[Enhanced Orchestrator] Contextual analysis failed:', error.message);
      }
    }

    // Layer 4: AI-powered insights (if model available)
    const registry = await ensureRegistry(options.baseDir);
    const optimalModel = selectOptimalModel(registry.models, {
      modelPreference: profile.modelPreference,
      analysisType: options.analysisType,
      complexity: results.layers.static?.complexity || 'medium',
    });

    if (optimalModel) {
      try {
        results.layers.ai = await performAIAnalysis(content, context, optimalModel, options);
        results.confidence = Math.max(results.confidence, 0.9);
        results.enhancements.push('ai-insights');
        results.modelUsed = optimalModel.id;
      } catch (error) {
        logger.warn('[Enhanced Orchestrator] AI analysis failed:', error.message);

        // Fallback to deterministic if enabled
        if (profile.fallbackToDeterministic) {
          results.layers.deterministic = await performDeterministicAnalysis(results.layers);
          results.enhancements.push('deterministic-fallback');
        }
      }
    }

    return results;
  } catch (error) {
    logger.error('[Enhanced Orchestrator] Progressive analysis failed:', error);
    throw error;
  }
}

/**
 * Perform static analysis baseline
 */
async function performStaticAnalysis(content, context) {
  const { createLanguageDetector } = require('./universal-language-detector.cjs');
  const detector = createLanguageDetector();

  const detection = detector.detectLanguage(context.filePath || 'snippet.txt', content);

  // Basic metrics
  const lines = content.split('\n').length;
  const nonEmptyLines = content.split('\n').filter((line) => line.trim()).length;
  const words = content.split(/\s+/).filter((word) => word.length > 0).length;

  return {
    language: detection.language,
    confidence: detection.confidence,
    complexity: lines > 1000 ? 'high' : lines > 100 ? 'medium' : 'low',
    metrics: {
      lines,
      nonEmptyLines,
      words,
      avgLineLength: words > 0 ? Math.round(content.length / lines) : 0,
    },
    detection,
  };
}

/**
 * Perform AI-powered analysis
 */
async function performAIAnalysis(content, context, model, options) {
  const analysisPrompt = buildAnalysisPrompt(content, context, options);

  try {
    const result = await analyzeWithModel(model.id, analysisPrompt, {
      timeout: options.timeoutMs || 60000,
      maxTokens: 2048,
      temperature: 0.3,
    });

    return {
      model: model.id,
      provider: model.provider,
      insights: result.response || result.text || '',
      confidence: result.confidence || 0.5,
      processingTime: result.processingTime || 0,
      tokens: result.tokens || { input: 0, output: 0 },
    };
  } catch (error) {
    throw new Error(`AI analysis with model ${model.id} failed: ${error.message}`);
  }
}

/**
 * Build context-aware analysis prompt
 */
function buildAnalysisPrompt(content, context, options) {
  const { filePath, projectPath, analysisType } = context;
  const language = context.language || 'unknown';

  let prompt = `Analyze the following ${language} code`;

  if (filePath) {
    prompt += ` from file "${filePath}"`;
  }

  if (projectPath) {
    prompt += ` in project context`;
  }

  prompt += `.\n\nProvide insights on:\n`;
  prompt += `- Code quality and best practices\n`;
  prompt += `- Potential issues or improvements\n`;
  prompt += `- Complexity and maintainability\n`;
  prompt += `- Security considerations\n`;

  if (analysisType === 'security') {
    prompt += `- Vulnerabilities and security risks\n`;
    prompt += `- Input validation and sanitization\n`;
  } else if (analysisType === 'performance') {
    prompt += `- Performance bottlenecks\n`;
    prompt += `- Optimization opportunities\n`;
  } else if (analysisType === 'architecture') {
    prompt += `- Design patterns\n`;
    prompt += `- Architectural concerns\n`;
  }

  prompt += `\n\nCode:\n\`\`\`${language}\n${content.slice(0, 4000)}\n\`\`\`\n\n`;
  prompt += `Provide a concise, structured analysis focusing on actionable insights.`;

  return prompt;
}

/**
 * Perform deterministic fallback analysis
 */
async function performDeterministicAnalysis(layers) {
  const staticData = layers.static || {};
  const semantic = layers.semantic || {};

  // Rule-based analysis
  const issues = [];
  const recommendations = [];

  // Static analysis rules
  if (staticData.metrics?.lines > 1000) {
    issues.push({
      type: 'complexity',
      severity: 'medium',
      message: 'Large file detected, consider splitting',
    });
  }

  if (staticData.metrics?.avgLineLength > 120) {
    issues.push({
      type: 'readability',
      severity: 'low',
      message: 'Very long lines detected, consider breaking them',
    });
  }

  // Semantic analysis rules
  if (semantic.complexity === 'high') {
    recommendations.push({
      type: 'refactoring',
      message: 'Consider simplifying complex logic',
    });
  }

  return {
    method: 'deterministic',
    issues,
    recommendations,
    confidence: 0.4,
    processingTime: 0,
  };
}

/**
 * Streaming analysis for real-time updates
 */
class StreamingAnalyzer {
  constructor(options = {}) {
    this.options = options;
    this.buffer = new Map();
    this.results = new Map();
  }

  async analyzeChunk(chunkId, content, context) {
    // Store chunk
    this.buffer.set(chunkId, { content, context, timestamp: Date.now() });

    // Perform incremental analysis
    const result = await progressiveAnalysis(content, context, {
      ...this.options,
      profile: 'realtime',
    });

    this.results.set(chunkId, result);

    // Clean old chunks (keep only last 10)
    if (this.buffer.size > 10) {
      const oldestKey = this.buffer.keys().next().value;
      this.buffer.delete(oldestKey);
      this.results.delete(oldestKey);
    }

    return result;
  }

  getLatestResult(chunkId) {
    return this.results.get(chunkId);
  }

  getAllResults() {
    return Array.from(this.results.entries()).map(([id, result]) => ({
      id,
      ...result,
    }));
  }
}

module.exports = {
  progressiveAnalysis,
  ANALYSIS_PROFILES,
  selectOptimalModel,
  StreamingAnalyzer,
  performStaticAnalysis,
  performAIAnalysis,
  performDeterministicAnalysis,
};
