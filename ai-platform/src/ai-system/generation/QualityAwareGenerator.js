/**
 * Quality-Aware Mock Data Generation System
 * 
 * Self-improving generation models with quality scoring,
 * real-time optimization, and adaptive learning capabilities
 */

const logger = require('../../lib/app-logger');

class QualityAwareGenerator {
  constructor(options = {}) {
    this.options = options;
    this.qualityThresholds = {
      excellent: 95,
      good: 85,
      acceptable: 70,
      poor: 50
    };
    this.generationHistory = [];
    this.qualityMetrics = new Map();
    this.adaptiveThresholds = new Map();
    this.optimizationStrategies = new Map();
    this.isInitialized = false;
    this.learningRate = options.learningRate || 0.1;
    this.adaptationEnabled = options.adaptationEnabled !== false;
    
    this.initializeQualityMetrics();
    this.initializeOptimizationStrategies();
    logger.debug('[QUALITY_AWARE_GENERATOR] Quality-aware generator initialized');
  }

  // Initialize quality metrics
  initializeQualityMetrics() {
    // Structure quality metrics
    this.addQualityMetric('structure_completeness', {
      weight: 0.25,
      calculate: (data) => this.calculateStructureCompleteness(data),
      threshold: 0.9
    });

    this.addQualityMetric('structure_consistency', {
      weight: 0.20,
      calculate: (data) => this.calculateStructureConsistency(data),
      threshold: 0.85
    });

    // Content quality metrics
    this.addQualityMetric('content_diversity', {
      weight: 0.20,
      calculate: (data) => this.calculateContentDiversity(data),
      threshold: 0.8
    });

    this.addQualityMetric('content_relevance', {
      weight: 0.15,
      calculate: (data) => this.calculateContentRelevance(data),
      threshold: 0.85
    });

    // Format quality metrics
    this.addQualityMetric('format_validity', {
      weight: 0.15,
      calculate: (data) => this.calculateFormatValidity(data),
      threshold: 0.95
    });

    this.addQualityMetric('format_consistency', {
      weight: 0.10,
      calculate: (data) => this.calculateFormatConsistency(data),
      threshold: 0.9
    });

    // Performance quality metrics
    this.addQualityMetric('generation_efficiency', {
      weight: 0.10,
      calculate: (data, metadata) => this.calculateGenerationEfficiency(data, metadata),
      threshold: 0.8
    });

    logger.debug(`[QUALITY_AWARE_GENERATOR] Initialized ${this.qualityMetrics.size} quality metrics`);
  }

  // Initialize optimization strategies
  initializeOptimizationStrategies() {
    // Structure optimization
    this.addOptimizationStrategy('structure_optimization', {
      applicable: (quality) => quality.structure_completeness < 0.8 || quality.structure_consistency < 0.8,
      optimize: (data, quality) => this.optimizeStructure(data, quality),
      priority: 'high'
    });

    // Content optimization
    this.addOptimizationStrategy('content_optimization', {
      applicable: (quality) => quality.content_diversity < 0.7 || quality.content_relevance < 0.8,
      optimize: (data, quality) => this.optimizeContent(data, quality),
      priority: 'medium'
    });

    // Format optimization
    this.addOptimizationStrategy('format_optimization', {
      applicable: (quality) => quality.format_validity < 0.9 || quality.format_consistency < 0.85,
      optimize: (data, quality) => this.optimizeFormat(data, quality),
      priority: 'high'
    });

    // Performance optimization
    this.addOptimizationStrategy('performance_optimization', {
      applicable: (quality) => quality.generation_efficiency < 0.7,
      optimize: (data, quality) => this.optimizePerformance(data, quality),
      priority: 'medium'
    });

    logger.debug(`[QUALITY_AWARE_GENERATOR] Initialized ${this.optimizationStrategies.size} optimization strategies`);
  }

  // Add quality metric
  addQualityMetric(name, metric) {
    this.qualityMetrics.set(name, {
      ...metric,
      history: [],
      average: 0,
      trend: 'stable'
    });
    logger.debug(`[QUALITY_AWARE_GENERATOR] Added quality metric: ${name}`);
  }

  // Add optimization strategy
  addOptimizationStrategy(name, strategy) {
    this.optimizationStrategies.set(name, {
      ...strategy,
      usage: 0,
      success: 0,
      lastUsed: null
    });
    logger.debug(`[QUALITY_AWARE_GENERATOR] Added optimization strategy: ${name}`);
  }

  // Initialize system
  async initialize() {
    if (this.isInitialized) {
      logger.debug('[QUALITY_AWARE_GENERATOR] Generator already initialized');
      return;
    }

    try {
      // Load historical data
      this.loadHistoricalData();
      
      // Initialize adaptive thresholds
      this.initializeAdaptiveThresholds();
      
      this.isInitialized = true;
      logger.debug('[QUALITY_AWARE_GENERATOR] Quality-aware generator initialized successfully');
      
    } catch (error) {
      console.error('[QUALITY_AWARE_GENERATOR] Failed to initialize:', error.message);
      throw error;
    }
  }

  // Generate quality-aware data
  async generateData(request) {
    const {
      type,
      count = 1,
      quality = 'high',
      adaptive = this.adaptationEnabled,
      context = {}
    } = request;

    try {
      // Initial generation
      const initialData = await this.generateInitialData(type, count, context);
      
      // Quality assessment
      const initialQuality = await this.assessQuality(initialData);
      
      // Optimization if needed
      let optimizedData = initialData;
      if (adaptive && this.shouldOptimize(initialQuality, quality)) {
        optimizedData = await this.optimizeGeneration(initialData, initialQuality, quality);
      }
      
      // Final quality assessment
      const finalQuality = await this.assessQuality(optimizedData);
      
      // Learning and adaptation
      if (this.adaptationEnabled) {
        await this.learnFromGeneration(initialData, optimizedData, initialQuality, finalQuality, request);
      }
      
      // Store in history
      this.storeGeneration(initialData, optimizedData, initialQuality, finalQuality, request);

      const result = {
        success: true,
        type,
        count,
        data: optimizedData,
        quality: {
          initial: initialQuality,
          final: finalQuality,
          improvement: finalQuality.overall - initialQuality.overall,
          grade: this.getQualityGrade(finalQuality.overall)
        },
        adaptive,
        optimizations: this.getAppliedOptimizations(initialQuality, finalQuality),
        timestamp: new Date().toISOString()
      };

      logger.debug(`[QUALITY_AWARE_GENERATOR] Generated ${count} ${type} records with quality ${finalQuality.overall} (${result.quality.grade})`);
      return result;

    } catch (error) {
      console.error(`[QUALITY_AWARE_GENERATOR] Generation failed:`, error.message);
      
      return {
        success: false,
        type,
        count,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Generate initial data
  async generateInitialData(type, count, context) {
    // This would integrate with the IntelligentGenerator
    // For now, we'll create a simple implementation
    const data = [];

    for (let i = 0; i < count; i++) {
      const item = this.generateBasicItem(type, context);
      data.push(item);
    }

    return data;
  }

  // Generate basic item
  generateBasicItem(type, context) {
    const item = {
      id: this.generateId(),
      type: type,
      created_at: new Date().toISOString()
    };

    // Add type-specific fields
    switch (type) {
      case 'user':
        item.name = this.generateName();
        item.email = this.generateEmail();
        break;
      case 'product':
        item.name = this.generateProductName();
        item.price = this.generatePrice();
        item.category = this.generateCategory();
        break;
      case 'order':
        item.user_id = this.generateId();
        item.status = 'pending';
        item.total = 0;
        break;
      case 'event':
        item.event_type = 'user_action';
        item.source = 'web_app';
        item.data = {};
        break;
    }

    return item;
  }

  // Assess quality of generated data
  async assessQuality(data) {
    const quality = {};
    let totalScore = 0;
    let totalWeight = 0;

    // Calculate each metric
    this.qualityMetrics.forEach((metric, name) => {
      const score = metric.calculate(data);
      quality[name] = score;
      totalScore += score * metric.weight;
      totalWeight += metric.weight;

      // Update metric history
      metric.history.push(score);
      if (metric.history.length > 100) {
        metric.history = metric.history.slice(-100);
      }

      // Update average and trend
      metric.average = metric.history.reduce((sum, s) => sum + s, 0) / metric.history.length;
      metric.trend = this.calculateTrend(metric.history);
    });

    quality.overall = totalWeight > 0 ? totalScore / totalWeight : 0;
    quality.grade = this.getQualityGrade(quality.overall);

    return quality;
  }

  // Determine if optimization is needed
  shouldOptimize(quality, targetQuality) {
    const targetScore = this.getTargetQualityScore(targetQuality);
    return quality.overall < targetScore;
  }

  // Optimize generation
  async optimizeGeneration(data, currentQuality, targetQuality) {
    let optimizedData = JSON.parse(JSON.stringify(data)); // Deep clone
    const appliedOptimizations = [];

    // Find applicable optimization strategies
    const applicableStrategies = Array.from(this.optimizationStrategies.entries())
      .filter(([name, strategy]) => strategy.applicable(currentQuality));

    // Apply optimizations in priority order
    const sortedStrategies = applicableStrategies.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b[1].priority] - priorityOrder[a[1].priority];
    });

    for (const [name, strategy] of sortedStrategies) {
      try {
        optimizedData = await strategy.optimize(optimizedData, currentQuality);
        appliedOptimizations.push(name);
        
        // Update strategy stats
        strategy.usage++;
        strategy.lastUsed = new Date().toISOString();
        
        // Re-assess quality after optimization
        const newQuality = await this.assessQuality(optimizedData);
        
        if (newQuality.overall >= this.getTargetQualityScore(targetQuality)) {
          break; // Stop optimizing if target reached
        }
        
        currentQuality = newQuality;
        
      } catch (error) {
        console.error(`[QUALITY_AWARE_GENERATOR] Optimization ${name} failed:`, error.message);
      }
    }

    return optimizedData;
  }

  // Optimization implementations
  async optimizeStructure(data, quality) {
    if (!Array.isArray(data)) return data;

    return data.map(item => {
      // Ensure required fields
      if (!item.id) item.id = this.generateId();
      if (!item.created_at) item.created_at = new Date().toISOString();
      if (!item.updated_at) item.updated_at = new Date().toISOString();
      
      // Ensure consistent field types
      Object.keys(item).forEach(key => {
        const value = item[key];
        if (value === null || value === undefined) {
          item[key] = this.getDefaultValue(key);
        }
      });
      
      return item;
    });
  }

  async optimizeContent(data, quality) {
    if (!Array.isArray(data)) return data;

    return data.map(item => {
      // Enhance content diversity
      if (item.name && item.name.length < 5) {
        item.name = this.enhanceName(item.name);
      }
      
      // Improve content relevance
      if (item.description && item.description.length < 10) {
        item.description = this.enhanceDescription(item.description);
      }
      
      return item;
    });
  }

  async optimizeFormat(data, quality) {
    if (!Array.isArray(data)) return data;

    return data.map(item => {
      // Fix format issues
      Object.keys(item).forEach(key => {
        const value = item[key];
        
        if (typeof value === 'string') {
          // Fix undefined/NaN values
          item[key] = value.replace(/undefined/g, 'null').replace(/NaN/g, '0');
          
          // Fix email format
          if (key.toLowerCase().includes('email')) {
            item[key] = this.fixEmailFormat(value);
          }
          
          // Fix date format
          if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
            item[key] = this.fixDateFormat(value);
          }
        }
      });
      
      return item;
    });
  }

  async optimizePerformance(data, quality) {
    // Performance optimization focuses on generation efficiency
    // This is more about the generation process than the data itself
    return data;
  }

  // Learn from generation
  async learnFromGeneration(initialData, optimizedData, initialQuality, finalQuality, request) {
    // Update adaptive thresholds
    this.updateAdaptiveThresholds(request.type, finalQuality);
    
    // Update optimization strategy success rates
    this.updateOptimizationStrategies(initialQuality, finalQuality);
    
    // Update quality metrics
    this.updateQualityMetrics(finalQuality);
  }

  // Quality metric calculations
  calculateStructureCompleteness(data) {
    if (!Array.isArray(data)) return 0;

    let totalCompleteness = 0;
    
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        const requiredFields = ['id', 'created_at'];
        const presentFields = Object.keys(item);
        const completeness = requiredFields.filter(field => presentFields.includes(field)).length / requiredFields.length;
        totalCompleteness += completeness;
      }
    });

    return data.length > 0 ? totalCompleteness / data.length : 0;
  }

  calculateStructureConsistency(data) {
    if (!Array.isArray(data)) return 0;

    let totalConsistency = 0;
    
    // Check field consistency across items
    if (data.length > 0) {
      const firstItem = data[0];
      const fields = Object.keys(firstItem);
      
      data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          const itemFields = Object.keys(item);
          const commonFields = fields.filter(field => itemFields.includes(field));
          const consistency = commonFields.length / fields.length;
          totalConsistency += consistency;
        }
      });
    }

    return data.length > 0 ? totalConsistency / data.length : 0;
  }

  calculateContentDiversity(data) {
    if (!Array.isArray(data)) return 0;

    let totalDiversity = 0;
    
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        const values = Object.values(item);
        const uniqueTypes = new Set(values.map(v => typeof v));
        const diversity = uniqueTypes.size / 5; // Normalize by max possible types
        totalDiversity += diversity;
      }
    });

    return data.length > 0 ? totalDiversity / data.length : 0;
  }

  calculateContentRelevance(data) {
    if (!Array.isArray(data)) return 0;

    let totalRelevance = 0;
    
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        let relevance = 0;
        
        // Check for relevant content
        if (item.name && item.name.length > 5) relevance += 0.3;
        if (item.description && item.description.length > 10) relevance += 0.3;
        if (item.category) relevance += 0.2;
        if (item.status) relevance += 0.2;
        
        totalRelevance += Math.min(1, relevance);
      }
    });

    return data.length > 0 ? totalRelevance / data.length : 0;
  }

  calculateFormatValidity(data) {
    if (!Array.isArray(data)) return 0;

    let totalValidity = 0;
    
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        let validity = 1;
        
        // Check for format issues
        Object.values(item).forEach(value => {
          if (typeof value === 'string') {
            if (value.includes('undefined') || value.includes('NaN')) {
              validity -= 0.2;
            }
            if (value.includes('') || value.includes('')) {
              validity -= 0.1;
            }
          }
        });
        
        totalValidity += Math.max(0, validity);
      }
    });

    return data.length > 0 ? totalValidity / data.length : 0;
  }

  calculateFormatConsistency(data) {
    if (!Array.isArray(data)) return 0;

    let totalConsistency = 0;
    
    // Check format consistency across similar fields
    if (data.length > 1) {
      const firstItem = data[0];
      
      Object.keys(firstItem).forEach(key => {
        let consistent = true;
        const firstValue = firstItem[key];
        const firstType = typeof firstValue;
        
        data.forEach(item => {
          if (typeof item === 'object' && item !== null && item.hasOwnProperty(key)) {
            const currentValue = item[key];
            const currentType = typeof currentValue;
            
            if (currentType !== firstType) {
              consistent = false;
            }

            // Check string format consistency
            if (firstType === 'string' && currentType === 'string') {
              if (firstValue.includes('@') && !currentValue.includes('@')) {
                consistent = false;
              }
              if (firstValue.includes('T') && !currentValue.includes('T')) {
                consistent = false;
              }
            }
          }
        });
        
        if (consistent) {
          totalConsistency += 1;
        }
      });
    }

    return data.length > 0 ? totalConsistency / Object.keys(data[0]).length : 0;
  }

  calculateGenerationEfficiency(data, metadata) {
    // Simplified efficiency calculation
    const dataSize = JSON.stringify(data).length;
    const processingTime = metadata?.processingTime || 1000;
    
    // Efficiency based on size and processing time
    const efficiency = Math.max(0, 1 - (processingTime / 10000) - (dataSize / 1000000));
    
    return efficiency;
  }

  // Helper methods
  getTargetQualityScore(quality) {
    switch (quality) {
      case 'excellent': return this.qualityThresholds.excellent;
      case 'good': return this.qualityThresholds.good;
      case 'acceptable': return this.qualityThresholds.acceptable;
      case 'poor': return this.qualityThresholds.poor;
      default: return this.qualityThresholds.good;
    }
  }

  getQualityGrade(score) {
    if (score >= this.qualityThresholds.excellent) return 'excellent';
    if (score >= this.qualityThresholds.good) return 'good';
    if (score >= this.qualityThresholds.acceptable) return 'acceptable';
    return 'poor';
  }

  calculateTrend(history) {
    if (history.length < 2) return 'stable';
    
    const firstHalf = history.slice(0, Math.floor(history.length / 2));
    const secondHalf = history.slice(Math.floor(history.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const change = secondAvg - firstAvg;
    
    if (change > 0.05) return 'improving';
    if (change < -0.05) return 'declining';
    return 'stable';
  }

  // Data generation helpers
  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateName() {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'];
    
    return firstNames[Math.floor(Math.random() * firstNames.length)] + ' ' +
           lastNames[Math.floor(Math.random() * lastNames.length)];
  }

  generateEmail() {
    const names = ['user', 'test', 'demo', 'sample'];
    const domains = ['example.com', 'test.com', 'demo.com'];
    
    return names[Math.floor(Math.random() * names.length)] + '@' + 
           domains[Math.floor(Math.random() * domains.length)];
  }

  generateProductName() {
    const adjectives = ['Wireless', 'Digital', 'Smart', 'Premium', 'Professional'];
    const products = ['Mouse', 'Keyboard', 'Monitor', 'Camera', 'Speaker'];
    
    return adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' +
           products[Math.floor(Math.random() * products.length)];
  }

  generatePrice() {
    return Math.round((Math.random() * 1000 + 10) * 100) / 100;
  }

  generateCategory() {
    const categories = ['Electronics', 'Clothing', 'Books', 'Home', 'Sports'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  enhanceName(name) {
    const enhancements = ['Professional', 'Premium', 'Advanced', 'Deluxe'];
    return enhancements[Math.floor(Math.random() * enhancements.length)] + ' ' + name;
  }

  enhanceDescription(description) {
    const enhancements = [
      'High-quality product with excellent features',
      'Premium item with advanced capabilities',
      'Professional-grade solution with modern design',
      'Advanced technology with superior performance'
    ];
    return enhancements[Math.floor(Math.random() * enhancements.length)];
  }

  fixEmailFormat(email) {
    if (!email.includes('@')) {
      return email + '@example.com';
    }
    
    const [local, domain] = email.split('@');
    if (!domain.includes('.')) {
      return local + '@' + domain + '.com';
    }
    
    return email.toLowerCase();
  }

  fixDateFormat(dateString) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    return new Date().toISOString();
  }

  getDefaultValue(field) {
    const fieldLower = field.toLowerCase();
    
    if (fieldLower.includes('name')) return 'Default Name';
    if (fieldLower.includes('email')) return 'default@example.com';
    if (fieldLower.includes('price')) return 0;
    if (fieldLower.includes('status')) return 'active';
    if (fieldLower.includes('category')) return 'general';
    
    return null;
  }

  // Store generation in history
  storeGeneration(initialData, optimizedData, initialQuality, finalQuality, request) {
    const generation = {
      timestamp: new Date().toISOString(),
      request,
      initialData,
      optimizedData,
      initialQuality,
      finalQuality,
      improvement: finalQuality.overall - initialQuality.overall
    };

    this.generationHistory.push(generation);
    
    // Keep only last 1000 generations
    if (this.generationHistory.length > 1000) {
      this.generationHistory = this.generationHistory.slice(-1000);
    }
  }

  // Get applied optimizations
  getAppliedOptimizations(initialQuality, finalQuality) {
    const optimizations = [];
    
    if (finalQuality.structure_completeness > initialQuality.structure_completeness) {
      optimizations.push('structure_optimization');
    }
    
    if (finalQuality.content_diversity > initialQuality.content_diversity) {
      optimizations.push('content_optimization');
    }
    
    if (finalQuality.format_validity > initialQuality.format_validity) {
      optimizations.push('format_optimization');
    }
    
    if (finalQuality.generation_efficiency > initialQuality.generation_efficiency) {
      optimizations.push('performance_optimization');
    }
    
    return optimizations;
  }

  // Update adaptive thresholds
  updateAdaptiveThresholds(type, quality) {
    if (!this.adaptiveThresholds.has(type)) {
      this.adaptiveThresholds.set(type, {
        history: [],
        current: this.qualityThresholds.good,
        target: this.qualityThresholds.good
      });
    }

    const threshold = this.adaptiveThresholds.get(type);
    threshold.history.push(quality.overall);
    
    if (threshold.history.length > 50) {
      threshold.history = threshold.history.slice(-50);
      
      // Adjust threshold based on recent performance
      const recentAverage = threshold.history.reduce((sum, score) => sum + score, 0) / threshold.history.length;
      
      if (recentAverage > this.qualityThresholds.excellent) {
        threshold.target = this.qualityThresholds.excellent;
      } else if (recentAverage < this.qualityThresholds.acceptable) {
        threshold.target = this.qualityThresholds.acceptable;
      }
      
      threshold.current = threshold.current * (1 - this.learningRate) + threshold.target * this.learningRate;
    }
  }

  // Update optimization strategies
  updateOptimizationStrategies(initialQuality, finalQuality) {
    const improvement = finalQuality.overall - initialQuality.overall;
    
    this.optimizationStrategies.forEach(strategy => {
      if (improvement > 0) {
        strategy.success++;
      }
    });
  }

  // Update quality metrics
  updateQualityMetrics(quality) {
    this.qualityMetrics.forEach((metric, name) => {
      const score = quality[name];
      if (score !== undefined) {
        metric.history.push(score);
        if (metric.history.length > 100) {
          metric.history = metric.history.slice(-100);
        }
        
        metric.average = metric.history.reduce((sum, s) => sum + s, 0) / metric.history.length;
        metric.trend = this.calculateTrend(metric.history);
      }
    });
  }

  // Get statistics
  getStats() {
    const recentGenerations = this.generationHistory.slice(-100);
    
    const avgImprovement = recentGenerations.length > 0 
      ? recentGenerations.reduce((sum, gen) => sum + gen.improvement, 0) / recentGenerations.length 
      : 0;

    return {
      totalGenerations: this.generationHistory.length,
      averageImprovement: Math.round(avgImprovement * 100) / 100,
      qualityMetrics: Array.from(this.qualityMetrics.entries()).map(([name, metric]) => ({
        name,
        average: Math.round(metric.average * 100) / 100,
        trend: metric.trend,
        threshold: metric.threshold
      })),
      optimizationStrategies: Array.from(this.optimizationStrategies.entries()).map(([name, strategy]) => ({
        name,
        usage: strategy.usage,
        success: strategy.success,
        successRate: strategy.usage > 0 ? Math.round((strategy.success / strategy.usage) * 100) / 100 : 0
      })),
      adaptiveThresholds: Array.from(this.adaptiveThresholds.entries()).map(([type, threshold]) => ({
        type,
        current: Math.round(threshold.current * 100) / 100,
        target: Math.round(threshold.target * 100) / 100,
        history: threshold.history.length
      })),
      qualityThresholds: this.qualityThresholds,
      learningRate: this.learningRate,
      adaptationEnabled: this.adaptationEnabled
    };
  }

  // Load historical data
  loadHistoricalData() {
    try {
      const saved = localStorage.getItem('quality_aware_history');
      if (saved) {
        this.generationHistory = JSON.parse(saved);
        logger.debug(`[QUALITY_AWARE_GENERATOR] Loaded ${this.generationHistory.length} generations from history`);
      }
    } catch (error) {
      console.warn('[QUALITY_AWARE_GENERATOR] Failed to load historical data:', error.message);
    }
  }

  // Save historical data
  saveHistoricalData() {
    try {
      localStorage.setItem('quality_aware_history', JSON.stringify(this.generationHistory));
      logger.debug(`[QUALITY_AWARE_GENERATOR] Saved ${this.generationHistory.length} generations to history`);
    } catch (error) {
      console.warn('[QUALITY_AWARE_GENERATOR] Failed to save historical data:', error.message);
    }
  }

  // Initialize adaptive thresholds
  initializeAdaptiveThresholds() {
    // Initialize with default thresholds for common types
    ['user', 'product', 'order', 'event'].forEach(type => {
      this.adaptiveThresholds.set(type, {
        history: [],
        current: this.qualityThresholds.good,
        target: this.qualityThresholds.good
      });
    });
  }

  // Export statistics
  exportStats() {
    const stats = this.getStats();
    
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-aware-stats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObject(url);
    
    logger.debug('[QUALITY_AWARE_GENERATOR] Statistics exported');
  }

  // Get system state
  getState() {
    return {
      qualityMetrics: Array.from(this.qualityMetrics.entries()).map(([name, metric]) => ({
        name,
        ...metric
      })),
      optimizationStrategies: Array.from(this.optimizationStrategies.entries()).map(([name, strategy]) => ({
        name,
        ...strategy
      })),
      adaptiveThresholds: Array.from(this.adaptiveThresholds.entries()).map(([type, threshold]) => ({
        type,
        ...threshold
      })),
      generationHistory: this.generationHistory,
      stats: this.getStats(),
      options: this.options
    };
  }

  // Destroy generator
  destroy() {
    this.saveHistoricalData();
    
    this.qualityMetrics.clear();
    this.optimizationStrategies.clear();
    this.adaptiveThresholds.clear();
    this.generationHistory = [];
    
    this.isInitialized = false;
    logger.debug('[QUALITY_AWARE_GENERATOR] Quality-aware generator destroyed');
  }
}

// Global instance
let qualityAwareGenerator = null;

// Initialize generator when DOM is ready
function initializeQualityAwareGenerator() {
  if (!qualityAwareGenerator) {
    qualityAwareGenerator = new QualityAwareGenerator();
  }
  return qualityAwareGenerator.initialize();
}

// Export for global access
window.qualityAwareGenerator = qualityAwareGenerator;

module.exports = {
  QualityAwareGenerator,
  initializeQualityAwareGenerator
};
