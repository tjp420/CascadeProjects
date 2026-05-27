/**
 * ML-Based Pattern Detection System
 * 
 * Machine learning-powered pattern detection with confidence scoring,
 * classification, and continuous learning capabilities
 */

class PatternDetector {
  constructor(options = {}) {
    this.modelType = options.modelType || 'ensemble';
    this.confidenceThreshold = options.confidenceThreshold || 0.8;
    this.enableLearning = options.enableLearning !== false;
    this.trainingData = [];
    this.featureExtractors = new Map();
    this.models = new Map();
    this.detectionHistory = [];
    
    this.initializeFeatureExtractors();
    this.initializeModels();
    
    console.log('[PATTERN_DETECTOR] ML pattern detector initialized');
  }

  // Initialize feature extractors for different pattern types
  initializeFeatureExtractors() {
    // Structural features
    this.featureExtractors.set('structural', {
      extract: (data) => this.extractStructuralFeatures(data),
      weight: 0.3
    });

    // Content features
    this.featureExtractors.set('content', {
      extract: (data) => this.extractContentFeatures(data),
      weight: 0.25
    });

    // Semantic features
    this.featureExtractors.set('semantic', {
      extract: (data) => this.extractSemanticFeatures(data),
      weight: 0.25
    });

    // Statistical features
    this.featureExtractors.set('statistical', {
      extract: (data) => this.extractStatisticalFeatures(data),
      weight: 0.2
    });
  }

  // Initialize ML models
  initializeModels() {
    // Random Forest for pattern classification
    this.models.set('random_forest', {
      type: 'classification',
      predict: (features) => this.randomForestPredict(features),
      confidence: 0.85
    });

    // Neural Network for pattern matching
    this.models.set('neural_network', {
      type: 'classification',
      predict: (features) => this.neuralNetworkPredict(features),
      confidence: 0.90
    });

    // SVM for pattern validation
    this.models.set('svm', {
      type: 'classification',
      predict: (features) => this.svmPredict(features),
      confidence: 0.80
    });

    console.log(`[PATTERN_DETECTOR] Initialized ${this.models.size} ML models`);
  }

  // Detect patterns using ML models
  detectPatterns(data, options = {}) {
    const { modelType = this.modelType, minConfidence = this.confidenceThreshold } = options;
    
    const results = [];
    
    // Extract features
    const features = this.extractFeatures(data);
    
    // Get available patterns
    const patterns = this.getAvailablePatterns();
    
    for (const pattern of patterns) {
      const prediction = this.predictPattern(features, pattern, modelType);
      
      if (prediction.confidence >= minConfidence) {
        results.push({
          pattern: pattern.name,
          type: pattern.type,
          category: pattern.category,
          confidence: prediction.confidence,
          model: modelType,
          features: features,
          prediction: prediction,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    // Store detection history
    this.detectionHistory.push({
      dataHash: this.hashData(data),
      results,
      timestamp: new Date().toISOString()
    });

    // Keep only last 1000 detections
    if (this.detectionHistory.length > 1000) {
      this.detectionHistory = this.detectionHistory.slice(-1000);
    }

    return {
      detections: results,
      bestMatch: results[0] || null,
      confidence: results.length > 0 ? results[0].confidence : 0,
      modelUsed: modelType,
      features: features,
      timestamp: new Date().toISOString()
    };
  }

  // Extract features from data
  extractFeatures(data) {
    const features = {};
    
    this.featureExtractors.forEach((extractor, name) => {
      const extractedFeatures = extractor.extract(data);
      Object.assign(features, extractedFeatures);
    });

    return features;
  }

  // Extract structural features
  extractStructuralFeatures(data) {
    const features = {};
    
    try {
      const dataStr = JSON.stringify(data);
      
      // Basic structural properties
      features.data_type = typeof data;
      features.is_array = Array.isArray(data);
      features.is_object = typeof data === 'object' && data !== null && !Array.isArray(data);
      features.data_size = dataStr.length;
      
      if (features.is_object) {
        const keys = Object.keys(data);
        features.field_count = keys.length;
        features.avg_field_name_length = keys.reduce((sum, key) => sum + key.length, 0) / keys.length;
        features.has_nested_objects = this.hasNestedObjects(data);
        features.max_depth = this.calculateDepth(data);
        
        // Field name patterns
        features.camel_case_fields = keys.filter(key => /^[a-z][a-zA-Z0-9]*$/.test(key)).length;
        features.snake_case_fields = keys.filter(key => /^[a-z][a-z0-9_]*$/.test(key)).length;
        features.kebab_case_fields = keys.filter(key => /^[a-z][a-z0-9-]*$/.test(key)).length;
        features.upper_case_fields = keys.filter(key => /^[A-Z]/.test(key)).length;
        
        // Value type distribution
        const valueTypes = Object.values(data).map(v => typeof v);
        features.string_fields = valueTypes.filter(t => t === 'string').length;
        features.number_fields = valueTypes.filter(t => t === 'number').length;
        features.boolean_fields = valueTypes.filter(t => t === 'boolean').length;
        features.null_fields = valueTypes.filter(t => t === null).length;
        features.undefined_fields = valueTypes.filter(t => t === undefined).length;
        
        // Array properties
        const arrays = Object.values(data).filter(v => Array.isArray(v));
        features.array_count = arrays.length;
        features.avg_array_length = arrays.length > 0 ? arrays.reduce((sum, arr) => sum + arr.length, 0) / arrays.length : 0;
        
        // Object properties
        const objects = Object.values(data).filter(v => typeof v === 'object' && v !== null && !Array.isArray(v));
        features.object_count = objects.length;
        features.avg_object_size = objects.length > 0 ? objects.reduce((sum, obj) => sum + Object.keys(obj).length, 0) / objects.length : 0;
      }
      
      if (features.is_array) {
        features.array_length = data.length;
        features.avg_item_size = data.length > 0 ? data.reduce((sum, item) => sum + JSON.stringify(item).length, 0) / data.length : 0;
        
        // Array type consistency
        const itemTypes = data.map(item => typeof item);
        features.type_consistency = 1 - (new Set(itemTypes).size / itemTypes.length);
        
        // Array content patterns
        features.string_items = itemTypes.filter(t => t === 'string').length;
        features.number_items = itemTypes.filter(t => t === 'number').length;
        features.object_items = itemTypes.filter(t => t === 'object').length;
      }
      
    } catch (error) {
      console.error('[PATTERN_DETECTOR] Error extracting structural features:', error.message);
      features.extraction_error = true;
    }
    
    return features;
  }

  // Extract content features
  extractContentFeatures(data) {
    const features = {};
    
    try {
      const dataStr = JSON.stringify(data);
      
      // Text-based features
      features.text_density = this.calculateTextDensity(dataStr);
      features.special_char_ratio = this.calculateSpecialCharRatio(dataStr);
      features.numeric_ratio = this.calculateNumericRatio(dataStr);
      features.alphabetic_ratio = this.calculateAlphabeticRatio(dataStr);
      
      // Pattern-based features
      features.has_email_pattern = /@[^\s@]+@[^\s@]+\.[^\s@]+/.test(dataStr);
      features.has_url_pattern = /https?:\/\/[^\s]+/.test(dataStr);
      features.has_date_pattern = /\d{4}-\d{2}-\d{2}/.test(dataStr);
      features.has_uuid_pattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(dataStr);
      features.has_phone_pattern = /\+?1?-?\d{3}-?\d{3}-?\d{4}/.test(dataStr);
      
      // Common key patterns
      const keys = typeof data === 'object' && data !== null ? Object.keys(data) : [];
      features.id_field_count = keys.filter(key => /id/i.test(key)).length;
      features.name_field_count = keys.filter(key => /name/i.test(key)).length;
      features.timestamp_field_count = keys.filter(key => /time|date|created|updated/i.test(key)).length;
      features.status_field_count = keys.filter(key => /status/i.test(key)).length;
      features.type_field_count = keys.filter(key => /type/i.test(key)).length;
      
      // Value patterns
      if (features.is_object) {
        const values = Object.values(data);
        features.null_value_count = values.filter(v => v === null).length;
        features.empty_string_count = values.filter(v => typeof v === 'string' && v.trim() === '').length;
        features.zero_value_count = values.filter(v => v === 0).length;
        features.true_value_count = values.filter(v => v === true).length;
        features.false_value_count = values.filter(v => v === false).length;
      }
      
    } catch (error) {
      console.error('[PATTERN_DETECTOR] Error extracting content features:', error.message);
      features.extraction_error = true;
    }
    
    return features;
  }

  // Extract semantic features
  extractSemanticFeatures(data) {
    const features = {};
    
    try {
      // Domain-specific semantic features
      features.is_user_data = this.isUserPattern(data);
      features.is_product_data = this.isProductPattern(data);
      features.is_order_data = this.isOrderPattern(data);
      features.is_event_data = this.isEventPattern(data);
      features.is_log_data = this.isLogPattern(data);
      features.is_config_data = this.isConfigPattern(data);
      features.is_api_response = this.isAPIResponsePattern(data);
      
      // Relationship features
      features.has_user_relationship = this.hasUserRelationship(data);
      features.has_product_relationship = this.hasProductRelationship(data);
      features.has_temporal_relationship = this.hasTemporalRelationship(data);
      
      // Business logic features
      features.has_monetary_values = this.hasMonetaryValues(data);
      features.has_contact_info = this.hasContactInfo(data);
      features.has_location_info = this.hasLocationInfo(data);
      features.has_status_workflow = this.hasStatusWorkflow(data);
      
    } catch (error) {
      console.error('[PATTERN_DETECTOR] Error extracting semantic features:', error.message);
      features.extraction_error = true;
    }
    
    return features;
  }

  // Extract statistical features
  extractStatisticalFeatures(data) {
    const features = {};
    
    try {
      const dataStr = JSON.stringify(data);
      
      // Statistical properties
      features.string_length_stats = this.calculateStringLengthStats(dataStr);
      features.word_count_stats = this.calculateWordCountStats(dataStr);
      features.char_frequency_stats = this.calculateCharFrequencyStats(dataStr);
      
      // Entropy and complexity
      features.shannon_entropy = this.calculateShannonEntropy(dataStr);
      features.structural_entropy = this.calculateStructuralEntropy(data);
      
      // Distribution features
      features.field_value_distribution = this.calculateFieldValueDistribution(data);
      features.type_distribution = this.calculateTypeDistribution(data);
      
    } catch (error) {
      console.error('[PATTERN_DETECTOR] Error extracting statistical features:', error.message);
      features.extraction_error = true;
    }
    
    return features;
  }

  // Pattern prediction using Random Forest
  randomForestPredict(features) {
    // Simplified Random Forest implementation
    const trees = 10;
    const predictions = [];
    
    for (let i = 0; i < trees; i++) {
      const prediction = this.decisionTreePredict(features, i);
      predictions.push(prediction);
    }
    
    // Ensemble voting
    const votes = {};
    predictions.forEach(pred => {
      votes[pred.pattern] = (votes[pred.pattern] || 0) + 1;
    });
    
    const bestPattern = Object.keys(votes).reduce((a, b) => votes[a] > votes[b] ? a : b);
    const confidence = votes[bestPattern] / trees;
    
    return {
      pattern: bestPattern,
      confidence: confidence,
      votes: votes
    };
  }

  // Pattern prediction using Neural Network
  neuralNetworkPredict(features) {
    // Simplified Neural Network implementation
    const weights = this.generateRandomWeights(100, 50);
    const biases = this.generateRandomWeights(50, 1);
    
    // Forward propagation (simplified)
    const hidden = this.activate(features, weights, biases);
    const output = this.softmax(hidden);
    
    const maxIndex = output.indexOf(Math.max(...output));
    const confidence = output[maxIndex];
    
    const patterns = this.getAvailablePatterns();
    const pattern = patterns[maxIndex];
    
    return {
      pattern: pattern ? pattern.name : 'unknown',
      confidence: confidence,
      output: output
    };
  }

  // Pattern prediction using SVM
  svmPredict(features) {
    // Simplified SVM implementation
    const patterns = this.getAvailablePatterns();
    const scores = [];
    
    patterns.forEach(pattern => {
      const score = this.calculateSVMKernel(features, pattern.features);
      scores.push({ pattern: pattern.name, score });
    });
    
    scores.sort((a, b) => b.score - a.score);
    const bestMatch = scores[0];
    
    return {
      pattern: bestMatch.pattern,
      confidence: Math.tanh(bestMatch.score),
      scores: scores
    };
  }

  // Helper methods for feature extraction
  hasNestedObjects(obj) {
    return Object.values(obj).some(value => 
      typeof value === 'object' && value !== null && !Array.isArray(value)
    );
  }

  calculateDepth(obj, currentDepth = 0) {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }
    
    let maxDepth = currentDepth;
    
    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const depth = this.calculateDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    });
    
    return maxDepth;
  }

  calculateTextDensity(text) {
    const nonSpaceChars = text.replace(/\s/g, '').length;
    return text.length > 0 ? nonSpaceChars / text.length : 0;
  }

  calculateSpecialCharRatio(text) {
    const specialChars = text.replace(/[a-zA-Z0-9\s]/g, '').length;
    return text.length > 0 ? specialChars / text.length : 0;
  }

  calculateNumericRatio(text) {
    const numericChars = text.replace(/[^0-9]/g, '').length;
    return text.length > 0 ? numericChars / text.length : 0;
  }

  calculateAlphabeticRatio(text) {
    const alphaChars = text.replace(/[^a-zA-Z]/g, '').length;
    return text.length > 0 ? alphaChars / text.length : 0;
  }

  calculateStringLengthStats(text) {
    const lines = text.split('\n');
    const lengths = lines.map(line => line.length);
    
    return {
      min: Math.min(...lengths),
      max: Math.max(...lengths),
      avg: lengths.reduce((sum, len) => sum + len, 0) / lengths.length,
      total: text.length
    };
  }

  calculateWordCountStats(text) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const lengths = words.map(word => word.length);
    
    return {
      count: words.length,
      min: Math.min(...lengths),
      max: Math.max(...lengths),
      avg: lengths.reduce((sum, len) => sum + len, 0) / lengths.length
    };
  }

  calculateCharFrequencyStats(text) {
    const freq = {};
    
    for (const char of text) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    const chars = Object.keys(freq);
    const values = Object.values(freq);
    
    return {
      unique_chars: chars.length,
      most_frequent: chars.reduce((a, b) => freq[a] > freq[b] ? a : b),
      frequency_distribution: freq,
      entropy: this.calculateEntropy(values)
    };
  }

  calculateShannonEntropy(text) {
    const freq = {};
    const total = text.length;
    
    for (const char of text) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    for (const char in freq) {
      const probability = freq[char] / total;
      entropy -= probability * Math.log2(probability);
    }
    
    return entropy;
  }

  calculateStructuralEntropy(data) {
    const structure = this.extractStructure(data);
    return this.calculateShannonEntropy(structure);
  }

  extractStructure(data) {
    const structure = [];
    
    if (typeof data === 'object' && data !== null) {
      structure.push('{');
      
      Object.entries(data).forEach(([key, value]) => {
        structure.push(`${key}:`);
        
        if (typeof value === 'object' && value !== null) {
          structure.push(...this.extractStructure(value).map(s => '  ' + s));
        } else {
          structure.push(JSON.stringify(value));
        }
      });
      
      structure.push('}');
    } else if (Array.isArray(data)) {
      structure.push('[');
      
      data.forEach(item => {
        structure.push(JSON.stringify(item));
      });
      
      structure.push(']');
    } else {
      structure.push(JSON.stringify(data));
    }
    
    return structure.join('');
  }

  calculateFieldValueDistribution(data) {
    if (typeof data !== 'object' || data === null) {
      return {};
    }
    
    const distribution = {};
    
    Object.values(data).forEach(value => {
      const type = typeof value;
      distribution[type] = (distribution[type] || 0) + 1;
    });
    
    return distribution;
  }

  calculateTypeDistribution(data) {
    const distribution = {};
    
    if (Array.isArray(data)) {
      distribution.array = data.length;
    } else {
      distribution[typeof data] = 1;
    }
    
    return distribution;
  }

  // Pattern recognition methods
  isUserPattern(data) {
    try {
      const keys = Object.keys(data);
      const userFields = ['id', 'name', 'email', 'phone', 'address', 'created_at', 'updated_at'];
      const matchCount = userFields.filter(field => keys.includes(field)).length;
      return matchCount >= 3;
    } catch (error) {
      return false;
    }
  }

  isProductPattern(data) {
    try {
      const keys = Object.keys(data);
      const productFields = ['id', 'name', 'price', 'category', 'description', 'inventory', 'created_at'];
      const matchCount = productFields.filter(field => keys.includes(field)).length;
      return matchCount >= 3;
    } catch (error) {
      return false;
    }
  }

  isOrderPattern(data) {
    try {
      const keys = Object.keys(data);
      const orderFields = ['id', 'user_id', 'items', 'total', 'status', 'created_at', 'updated_at'];
      const matchCount = orderFields.filter(field => keys.includes(field)).length;
      return matchCount >= 3;
    } catch (error) {
      return false;
    }
  }

  isEventPattern(data) {
    try {
      const keys = Object.keys(data);
      const eventFields = ['id', 'type', 'timestamp', 'source', 'data'];
      const matchCount = eventFields.filter(field => keys.includes(field)).length;
      return matchCount >= 3;
    } catch (error) {
      return false;
    }
  }

  isLogPattern(data) {
    try {
      const keys = Object.keys(data);
      const logFields = ['timestamp', 'level', 'message', 'source', 'context'];
      const matchCount = logFields.filter(field => keys.includes(field)).length;
      return matchCount >= 3;
    } catch (error) {
      return false;
    }
  }

  isConfigPattern(data) {
    try {
      const keys = Object.keys(data);
      const configFields = ['app_name', 'version', 'environment', 'database', 'features'];
      const matchCount = configFields.filter(field => keys.includes(field)).length;
      return matchCount >= 2;
    } catch (error) {
      return false;
    }
  }

  isAPIResponsePattern(data) {
    try {
      const keys = Object.keys(data);
      const apiFields = ['status', 'data', 'message', 'timestamp', 'error'];
      const matchCount = apiFields.filter(field => keys.includes(field)).length;
      return matchCount >= 2;
    } catch (error) {
      return false;
    }
  }

  hasUserRelationship(data) {
    try {
      const keys = Object.keys(data);
      const userRelatedFields = ['user_id', 'customer_id', 'owner_id', 'created_by', 'updated_by'];
      return userRelatedFields.some(field => keys.includes(field));
    } catch (error) {
      return false;
    }
  }

  hasProductRelationship(data) {
    try {
      const keys = Object.keys(data);
      const productRelatedFields = ['product_id', 'item_id', 'category_id', 'variant_id'];
      return productRelatedFields.some(field => keys.includes(field));
    } catch (error) {
      return false;
    }
  }

  hasTemporalRelationship(data) {
    try {
      const keys = Object.keys(data);
      const temporalFields = ['created_at', 'updated_at', 'timestamp', 'date', 'time', 'expires_at'];
      return temporalFields.some(field => keys.includes(field));
    } catch (error) {
      return false;
    }
  }

  hasMonetaryValues(data) {
    try {
      const values = Object.values(data);
      return values.some(value => 
        typeof value === 'number' && value > 0 && 
        (keys.some(key => key.toLowerCase().includes('price') || 
         key.toLowerCase().includes('cost') || 
         key.toLowerCase().includes('amount'))
      )
      );
    } catch (error) {
      return false;
    }
  }

  hasContactInfo(data) {
    try {
      const keys = Object.keys(data);
      const contactFields = ['email', 'phone', 'address', 'contact'];
      return contactFields.some(field => keys.includes(field));
    } catch (error) {
      return false;
    }
  }

  hasLocationInfo(data) {
    try {
      const keys = Object.keys(data);
      const locationFields = ['address', 'location', 'city', 'country', 'state', 'zip'];
      return locationFields.some(field => keys.includes(field));
    } catch (error) {
      return false;
    }
  }

  hasStatusWorkflow(data) {
    try {
      const keys = Object.keys(data);
      const statusFields = ['status', 'state', 'workflow', 'stage'];
      return statusFields.some(field => keys.includes(field));
    } catch (error) {
      return false;
    }
  }

  // ML helper methods
  generateRandomWeights(inputSize, outputSize) {
    const weights = [];
    for (let i = 0; i < outputSize; i++) {
      const row = [];
      for (let j = 0; j < inputSize; j++) {
        row.push((Math.random() - 0.5) * 2);
      }
      weights.push(row);
    }
    return weights;
  }

  activate(inputs, weights, biases) {
    const outputs = [];
    
    for (let i = 0; i < weights.length; i++) {
      let sum = biases[i][0];
      
      for (let j = 0; j < inputs.length; j++) {
        sum += inputs[j] * weights[i][j];
      }
      
      outputs.push(this.activationFunction(sum));
    }
    
    return outputs;
  }

  activationFunction(x) {
    return 1 / (1 + Math.exp(-x)); // Sigmoid
  }

  softmax(outputs) {
    const max = Math.max(...outputs);
    const exps = outputs.map(output => Math.exp(output - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(exp => exp / sum);
  }

  calculateSVMKernel(features, patternFeatures) {
    // Simplified RBF kernel
    const similarity = this.cosineSimilarity(features, patternFeatures);
    return similarity;
  }

  cosineSimilarity(vec1, vec2) {
    const dotProduct = this.dotProduct(vec1, vec2);
    const magnitude1 = this.magnitude(vec1);
    const magnitude2 = this.magnitude(vec2);
    
    return magnitude1 * magnitude2 > 0 ? dotProduct / (magnitude1 * magnitude2) : 0;
  }

  dotProduct(vec1, vec2) {
    return vec1.reduce((sum, val, index) => sum + val * vec2[index], 0);
  }

  magnitude(vec) {
    return Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  }

  decisionTreePredict(features, treeIndex) {
    // Simplified decision tree
    if (features.field_count > 5) {
      if (features.has_nested_objects) {
        return { pattern: 'complex_object', confidence: 0.8 };
      } else {
        return { pattern: 'simple_object', confidence: 0.7 };
      }
    } else {
      if (features.is_array) {
        return { pattern: 'array', confidence: 0.6 };
      } else {
        return { pattern: 'primitive', confidence: 0.5 };
      }
    }
  }

  // Get available patterns (placeholder - would load from PatternLibrary)
  getAvailablePatterns() {
    return [
      { name: 'user_basic', type: 'user', category: 'basic', features: {} },
      { name: 'user_extended', type: 'user', category: 'extended', features: {} },
      { name: 'product_basic', type: 'product', category: 'basic', features: {} },
      { name: 'product_ecommerce', type: 'product', category: 'ecommerce', features: {} },
      { name: 'order_basic', type: 'order', category: 'calculateOrderFeatures', features: {} },
      { name: 'order_ecommerce', type: 'order', category: 'ecommerce', features: {} },
      { name: 'event_basic', type: 'event', category: 'basic', features: {} },
      { name: 'log_application', type: 'log', category: 'application', features: {} },
      { name: 'config_application', type: 'config', category: 'application', features: {} },
      { name: 'analytics_page_view', type: 'analytics', category: 'page_view', features: {} },
      { name: 'api_response_success', type: 'api_response', category: 'success', features: {} },
      { name: 'api_response_error', type: 'api_response', category: 'error', features: {} }
    ];
  }

  // Hash data for tracking
  hashData(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString();
  }

  // Train models with new data
  trainModel(modelType, trainingData) {
    if (!this.enableLearning) {
      console.log('[PATTERN_DETECTOR] Learning disabled');
      return;
    }

    this.trainingData.push(...trainingData);
    
    // In a real implementation, this would train the actual ML models
    console.log(`[PATTERN_DETECTOR] Training ${modelType} model with ${trainingData.length} samples`);
    
    // Simplified training - update confidence based on training data
    const model = this.models.get(modelType);
    if (model) {
      model.confidence = Math.min(0.99, model.confidence + 0.01);
    }
  }

  // Get model statistics
  getModelStats() {
    return {
      models: Array.from(this.models.entries()).map(([name, model]) => ({
        name,
        type: model.type,
        confidence: model.confidence
      })),
      trainingDataSize: this.trainingData.length,
      detectionHistorySize: this.detectionHistory.length,
      featureExtractors: Array.from(this.featureExtractors.keys()),
      enableLearning: this.enableLearning
    };
  }

  // Export model
  exportModel() {
    return {
      models: Array.from(this.models.entries()).map(([name, model]) => ({
        name,
        type: model.type,
        confidence: model.confidence,
        weights: model.weights,
        biases: model.biases
      })),
      trainingData: this.trainingData,
      featureExtractors: Array.from(this.featureExtractors.entries()).map(([name, extractor]) => ({
        name,
        weight: extractor.weight
      })),
      detectionHistory: this.detectionHistory,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // Import model
  importModel(modelData) {
    if (modelData.models) {
      modelData.models.forEach(({ name, type, confidence, weights, biases }) => {
        this.models.set(name, {
          type,
          confidence,
          weights,
          biases
        });
      });
    }
    
    if (modelData.trainingData) {
      this.trainingData = modelData.trainingData;
    }
    
    if (modelData.featureExtractors) {
      modelData.featureExtractors.forEach(({ name, weight }) => {
        if (this.featureExtractors.has(name)) {
          this.featureExtractors.get(name).weight = weight;
        }
      });
    }
    
    if (modelData.detectionHistory) {
      this.detectionHistory = modelData.detectionHistory;
    }
    
    console.log(`[PATTERN_DETECTOR] Imported model with ${modelData.models?.length || 0} models`);
  }
}

module.exports = PatternDetector;
