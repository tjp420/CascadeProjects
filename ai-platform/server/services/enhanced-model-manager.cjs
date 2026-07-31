/**
 * Enhanced Model Manager
 *
 * Intelligent model selection, health monitoring, and automatic fallback
 * with circuit breaker pattern and performance tracking.
 */

const { ensureRegistry, getActiveModelInfo } = require('./local-model-service.cjs');
const { summarizeScanWithProvider } = require('./cloud-inference-service.cjs');
const { getUserAiCredentials } = require('../lib/user-ai-keys-store.cjs');
const logger = require('../../src/lib/app-logger.cjs');

/**
 * Circuit breaker states
 */
const CIRCUIT_STATES = {
  CLOSED: 'closed', // Normal operation
  OPEN: 'open', // Failing, reject requests
  HALF_OPEN: 'half-open', // Testing if failures are resolved
};

/**
 * Model health tracking
 */
class ModelHealthTracker {
  constructor() {
    this.models = new Map();
    this.circuitBreakers = new Map();
    this.performanceHistory = new Map();
  }

  /**
   * Record model performance
   */
  recordPerformance(modelId, metrics) {
    if (!this.performanceHistory.has(modelId)) {
      this.performanceHistory.set(modelId, []);
    }

    const history = this.performanceHistory.get(modelId);
    history.push({
      ...metrics,
      timestamp: Date.now(),
    });

    // Keep only last 100 records
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    // Update circuit breaker based on performance
    this.updateCircuitBreaker(modelId);
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreaker(modelId) {
    const history = this.performanceHistory.get(modelId) || [];
    const recent = history.slice(-10); // Last 10 requests

    if (recent.length < 5) return; // Not enough data

    const failureRate = recent.filter((r) => !r.success).length / recent.length;
    const avgResponseTime =
      recent.reduce((sum, r) => sum + (r.responseTime || 0), 0) / recent.length;

    const circuit = this.circuitBreakers.get(modelId) || {
      state: CIRCUIT_STATES.CLOSED,
      failures: 0,
      lastFailureTime: 0,
      lastTestTime: 0,
    };

    // Open circuit if too many failures
    if (failureRate > 0.5 && circuit.state === CIRCUIT_STATES.CLOSED) {
      circuit.state = CIRCUIT_STATES.OPEN;
      circuit.failures = recent.filter((r) => !r.success).length;
      circuit.lastFailureTime = Date.now();
      logger.warn(
        `[Model Manager] Circuit opened for model ${modelId} due to high failure rate: ${failureRate}`
      );
    }

    // Test circuit after timeout
    if (circuit.state === CIRCUIT_STATES.OPEN && Date.now() - circuit.lastFailureTime > 60000) {
      // 1 minute timeout
      circuit.state = CIRCUIT_STATES.HALF_OPEN;
      circuit.lastTestTime = Date.now();
      logger.info(`[Model Manager] Circuit half-open for model ${modelId}, testing...`);
    }

    // Close circuit if test succeeds
    if (circuit.state === CIRCUIT_STATES.HALF_OPEN && recent[recent.length - 1]?.success) {
      circuit.state = CIRCUIT_STATES.CLOSED;
      circuit.failures = 0;
      logger.info(`[Model Manager] Circuit closed for model ${modelId}, recovery successful`);
    }

    this.circuitBreakers.set(modelId, circuit);
  }

  /**
   * Check if model is available
   */
  isModelAvailable(modelId) {
    const circuit = this.circuitBreakers.get(modelId);
    return !circuit || circuit.state !== CIRCUIT_STATES.OPEN;
  }

  /**
   * Get model health summary
   */
  getHealthSummary(modelId) {
    const history = this.performanceHistory.get(modelId) || [];
    const circuit = this.circuitBreakers.get(modelId);
    const recent = history.slice(-10);

    return {
      modelId,
      available: this.isModelAvailable(modelId),
      circuitState: circuit?.state || CIRCUIT_STATES.CLOSED,
      recentRequests: recent.length,
      successRate: recent.length > 0 ? recent.filter((r) => r.success).length / recent.length : 0,
      avgResponseTime:
        recent.length > 0
          ? recent.reduce((sum, r) => sum + (r.responseTime || 0), 0) / recent.length
          : 0,
      lastUsed: recent.length > 0 ? recent[recent.length - 1].timestamp : null,
    };
  }
}

/**
 * Enhanced Model Manager
 */
class EnhancedModelManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.healthTracker = new ModelHealthTracker();
    this.modelCache = new Map();
    this.lastCacheUpdate = 0;
    this.cacheTimeoutMs = 30000; // 30 seconds
  }

  /**
   * Get optimal model for analysis with intelligent fallback
   */
  async getOptimalModel(requirements = {}) {
    const { preferredProvider, analysisType, complexity, maxResponseTime } = requirements;

    // Get available models
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      throw new Error('No models available');
    }

    // Filter by circuit breaker status
    const availableModels = models.filter((model) => this.healthTracker.isModelAvailable(model.id));

    if (availableModels.length === 0) {
      logger.warn('[Model Manager] All models have open circuits, forcing fallback');
      return this.getFallbackModel(models);
    }

    // Score models based on requirements
    const scoredModels = availableModels.map((model) => ({
      ...model,
      score: this.scoreModel(model, requirements),
    }));

    // Sort by score and return best
    scoredModels.sort((a, b) => b.score - a.score);

    const bestModel = scoredModels[0];
    logger.debug(
      `[Model Manager] Selected optimal model: ${bestModel.id} (score: ${bestModel.score})`
    );

    return bestModel;
  }

  /**
   * Score model based on requirements
   */
  scoreModel(model, requirements) {
    let score = 0;

    // Provider preference
    if (requirements.preferredProvider) {
      if (model.provider === requirements.preferredProvider) {
        score += 10;
      }
    }

    // Analysis type matching
    if (requirements.analysisType) {
      if (model.capabilities?.includes(requirements.analysisType)) {
        score += 8;
      }
    }

    // Performance considerations
    const health = this.healthTracker.getHealthSummary(model.id);
    score += health.successRate * 5;

    // Response time considerations
    if (requirements.maxResponseTime) {
      if (health.avgResponseTime <= requirements.maxResponseTime) {
        score += 5;
      } else {
        score -= 3;
      }
    }

    // Model size considerations
    if (model.size) {
      if (model.size.includes('34b')) score += 4;
      if (model.size.includes('13b')) score += 3;
      if (model.size.includes('7b')) score += 2;
    }

    // Provider reliability
    if (model.provider === 'ollama') score += 2; // Local models are more reliable
    if (model.provider === 'openai') score += 3; // High quality
    if (model.provider === 'anthropic') score += 3; // High quality

    return score;
  }

  /**
   * Get fallback model when all preferred models are unavailable
   */
  getFallbackModel(allModels) {
    // Prefer local models for reliability
    const localModels = allModels.filter((m) => m.provider === 'ollama');
    if (localModels.length > 0) {
      return localModels[0];
    }

    // Fall back to demo mode
    return {
      id: 'demo-fallback',
      provider: 'demo',
      name: 'Demo Fallback',
      capabilities: ['general'],
      score: 0,
      isFallback: true,
    };
  }

  /**
   * Execute analysis with automatic retry and fallback
   */
  async executeAnalysis(modelId, prompt, options = {}) {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || 2;
    const timeout = options.timeout || 60000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let model;

      try {
        // Get model (might be different on retry)
        if (attempt === 0) {
          model = await this.getModelById(modelId);
        } else {
          // On retry, get optimal model again
          model = await this.getOptimalModel(options.requirements);
          logger.info(`[Model Manager] Retry ${attempt + 1} with model: ${model.id}`);
        }

        // Check circuit breaker
        if (!this.healthTracker.isModelAvailable(model.id)) {
          throw new Error(`Model ${model.id} circuit is open`);
        }

        // Execute analysis based on provider
        let result;
        if (model.provider === 'demo') {
          result = await this.executeDemoAnalysis(prompt, options);
        } else if (model.provider === 'ollama') {
          result = await this.executeOllamaAnalysis(model, prompt, options);
        } else {
          result = await this.executeCloudAnalysis(model, prompt, options);
        }

        // Record successful performance
        this.healthTracker.recordPerformance(model.id, {
          success: true,
          responseTime: Date.now() - startTime,
          tokens: result.tokens || { input: 0, output: 0 },
        });

        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;

        // Record failed performance
        if (model) {
          this.healthTracker.recordPerformance(model.id, {
            success: false,
            responseTime,
            error: error.message,
          });
        }

        logger.warn(`[Model Manager] Analysis attempt ${attempt + 1} failed:`, error.message);

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw new Error(`Analysis failed after ${maxRetries + 1} attempts: ${error.message}`);
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * Execute demo analysis
   */
  async executeDemoAnalysis(prompt, options) {
    // Simple deterministic response for demo mode
    return {
      response: 'Demo analysis response - no actual AI processing performed.',
      confidence: 0.5,
      provider: 'demo',
      processingTime: 100,
      tokens: { input: prompt.length / 4, output: 50 },
    };
  }

  /**
   * Execute Ollama analysis
   */
  async executeOllamaAnalysis(model, prompt, options) {
    const { ollamaGenerate } = require('./ollama-client.cjs');

    const result = await ollamaGenerate(model.ollamaModel, prompt, {
      timeout: options.timeout || 60000,
      temperature: options.temperature || 0.3,
    });

    return {
      response: result.response,
      confidence: result.done ? 0.8 : 0.5,
      provider: 'ollama',
      processingTime: result.total_duration || 0,
      tokens: {
        input: result.prompt_eval_count || 0,
        output: result.eval_count || 0,
      },
    };
  }

  /**
   * Execute cloud analysis
   */
  async executeCloudAnalysis(model, prompt, options) {
    const userCredentials = await getUserAiCredentials(options.userEmail);

    const result = await summarizeScanWithProvider(
      model.provider,
      { prompt },
      {
        customPrompt: prompt,
        projectPath: options.projectPath || 'unknown',
        reportType: 'enhanced-analysis',
        userCredentials,
      }
    );

    return {
      response: result.summary,
      confidence: result.enhanced ? 0.8 : 0.5,
      provider: model.provider,
      processingTime: result.processingTime || 0,
      tokens: result.tokens || { input: 0, output: 0 },
    };
  }

  /**
   * Get available models with caching
   */
  async getAvailableModels() {
    const now = Date.now();

    if (now - this.lastCacheUpdate < this.cacheTimeoutMs && this.modelCache.size > 0) {
      return Array.from(this.modelCache.values());
    }

    try {
      const registry = await ensureRegistry(this.baseDir);
      const models = registry.models || [];

      // Update cache
      this.modelCache.clear();
      models.forEach((model) => {
        this.modelCache.set(model.id, model);
      });

      this.lastCacheUpdate = now;
      return models;
    } catch (error) {
      logger.error('[Model Manager] Failed to get available models:', error);
      return [];
    }
  }

  /**
   * Get model by ID
   */
  async getModelById(modelId) {
    const models = await this.getAvailableModels();
    return models.find((m) => m.id === modelId) || null;
  }

  /**
   * Get health report for all models
   */
  getHealthReport() {
    const models = Array.from(this.modelCache.values());
    return models.map((model) => this.healthTracker.getHealthSummary(model.id));
  }
}

// Singleton instance
const modelManagerInstances = new Map();

function getModelManager(baseDir) {
  if (!modelManagerInstances.has(baseDir)) {
    modelManagerInstances.set(baseDir, new EnhancedModelManager(baseDir));
  }
  return modelManagerInstances.get(baseDir);
}

module.exports = {
  EnhancedModelManager,
  ModelHealthTracker,
  getModelManager,
  CIRCUIT_STATES,
};
