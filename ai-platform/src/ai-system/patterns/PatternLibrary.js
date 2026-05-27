/**
 * Enhanced Pattern Library
 * 
 * Expanded pattern library with common mock data patterns,
 * pattern validation, classification, and recommendation system
 */

class PatternLibrary {
  constructor(options = {}) {
    this.patterns = new Map();
    this.classifications = new Map();
    this.recommendations = new Map();
    this.patternStats = new Map();
    this.enableMLDetection = options.enableMLDetection || true;
    this.confidenceThreshold = options.confidenceThreshold || 0.8;
    
    this.initializeDefaultPatterns();
    console.log('[PATTERNS] Pattern library initialized');
  }

  // Initialize default patterns for common mock data
  initializeDefaultPatterns() {
    // User data patterns
    this.addPattern('user_basic', {
      type: 'user',
      category: 'basic',
      fields: ['id', 'name', 'email', 'created_at'],
      structure: {
        id: 'string_uuid',
        name: 'string_name',
        email: 'string_email',
        created_at: 'datetime'
      },
      examples: [
        { id: 'uuid-123', name: 'John Doe', email: 'john@example.com', created_at: '2023-01-01T00:00:00Z' },
        { id: 'uuid-456', name: 'Jane Smith', email: 'jane@example.com', created_at: '2023-01-02T00:00:00Z' }
      ],
      frequency: 'high',
      confidence: 0.95
    });

    this.addPattern('user_extended', {
      type: 'user',
      category: 'extended',
      fields: ['id', 'name', 'email', 'phone', 'address', 'preferences', 'created_at', 'updated_at'],
      structure: {
        id: 'string_uuid',
        name: 'string_name',
        email: 'string_email',
        phone: 'string_phone',
        address: 'object_address',
        preferences: 'object_preferences',
        created_at: 'datetime',
        updated_at: 'datetime'
      },
      examples: [
        { id: 'uuid-789', name: 'Bob Johnson', email: 'bob@example.com', phone: '+1-555-0123', address: { street: '123 Main St', city: 'Anytown', country: 'USA' }, preferences: { theme: 'dark', notifications: true }, created_at: '2023-01-01T00:00:00Z', updated_at: '2023-01-01T12:00:00Z' }
      ],
      frequency: 'medium',
      confidence: 0.90
    });

    // Product data patterns
    this.addPattern('product_basic', {
      type: 'product',
      category: 'basic',
      fields: ['id', 'name', 'price', 'category', 'created_at'],
      structure: {
        id: 'string_uuid',
        name: 'string_product_name',
        price: 'number_decimal',
        category: 'string_category',
        created_at: 'datetime'
      },
      examples: [
        { id: 'prod-001', name: 'Wireless Mouse', price: 29.99, category: 'Electronics', created_at: '2023-01-01T00:00:00Z' },
        { id: 'prod-002', name: 'Mechanical Keyboard', price: 89.99, category: 'Electronics', created_at: '2023-01-02T00:00:00Z' }
      ],
      frequency: 'high',
      confidence: 0.92
    });

    this.addPattern('product_ecommerce', {
      type: 'product',
      category: 'ecommerce',
      fields: ['id', 'name', 'description', 'price', 'currency', 'category', 'tags', 'inventory', 'images', 'created_at', 'updated_at'],
      structure: {
        id: 'string_uuid',
        name: 'string_product_name',
        description: 'string_description',
        price: 'number_decimal',
        currency: 'string_currency',
        category: 'string_category',
        tags: 'array_string',
        inventory: 'object_inventory',
        images: 'array_string',
        created_at: 'datetime',
        updated_at: 'datetime'
      },
      examples: [
        { id: 'prod-003', name: 'Laptop Computer', description: 'High-performance laptop with 16GB RAM', price: 1299.99, currency: 'USD', category: 'Computers', tags: ['laptop', 'computer', 'electronics'], inventory: { available: 50, reserved: 5 }, images: ['img1.jpg', 'img2.jpg'], created_at: '2023-01-01T00:00:00Z', updated_at: '2023-01-01T12:00:00Z' }
      ],
      frequency: 'medium',
      confidence: 0.88
    });

    // Order data patterns
    this.addPattern('order_basic', {
      type: 'order',
      category: 'basic',
      fields: ['id', 'user_id', 'items', 'total', 'status', 'created_at'],
      structure: {
        id: 'string_uuid',
        user_id: 'string_uuid',
        items: 'array_order_items',
        total: 'number_decimal',
        status: 'string_status',
        created_at: 'datetime'
      },
      examples: [
        { id: 'order-001', user_id: 'user-123', items: [{ product_id: 'prod-001', quantity: 2, price: 29.99 }], total: 59.98, status: 'pending', created_at: '2023-01-01T00:00:00Z' }
      ],
      frequency: 'high',
      confidence: 0.94
    });

    this.addPattern('order_ecommerce', {
      type: 'order',
      category: 'ecommerce',
      fields: ['id', 'user_id', 'items', 'total', 'currency', 'status', 'payment_method', 'shipping_address', 'billing_address', 'created_at', 'updated_at'],
      structure: {
        id: 'string_uuid',
        user_id: 'string_uuid',
        items: 'array_order_items',
        total: 'number_decimal',
        currency: 'string_currency',
        status: 'string_status',
        payment_method: 'string_payment',
        shipping_address: 'object_address',
        billing_address: 'object_address',
        created_at: 'datetime',
        updated_at: 'datetime'
      },
      examples: [
        { id: 'order-002', user_id: 'user-456', items: [{ product_id: 'prod-002', quantity: 1, price: 89.99, options: { color: 'black', size: 'full' } }], total: 89.99, currency: 'USD', status: 'processing', payment_method: 'credit_card', shipping_address: { street: '456 Oak Ave', city: 'Springfield', country: 'USA' }, billing_address: { street: '456 Oak Ave', city: 'Springfield', country: 'USA' }, created_at: '2023-01-02T00:00:00Z', updated_at: '2023-01-02T01:00:00Z' }
      ],
      frequency: 'medium',
      confidence: 0.91
    });

    // Event data patterns
    this.addPattern('event_basic', {
      type: 'event',
      category: 'basic',
      fields: ['id', 'type', 'timestamp', 'source', 'data'],
      structure: {
        id: 'string_uuid',
        type: 'string_event_type',
        timestamp: 'datetime',
        source: 'string_source',
        data: 'object_event_data'
      },
      examples: [
        { id: 'event-001', type: 'user_action', timestamp: '2023-01-01T12:00:00Z', source: 'web_app', data: { action: 'login', user_id: 'user-123' } }
      ],
      frequency: 'high',
      confidence: 0.93
    });

    // Log data patterns
    this.addPattern('log_application', {
      type: 'log',
      category: 'application',
      fields: ['timestamp', 'level', 'message', 'source', 'context'],
      structure: {
        timestamp: 'datetime',
        level: 'string_log_level',
        message: 'string_message',
        source: 'string_source',
        context: 'object_context'
      },
      examples: [
        { timestamp: '2023-01-01T12:00:00Z', level: 'info', message: 'User logged in successfully', source: 'auth_service', context: { user_id: 'user-123', ip: '192.168.1.1' } }
      ],
      frequency: 'high',
      confidence: 0.96
    });

    // Configuration patterns
    this.addPattern('config_application', {
      type: 'config',
      category: 'application',
      fields: ['app_name', 'version', 'environment', 'database', 'features', 'logging'],
      structure: {
        app_name: 'string_app_name',
        version: 'string_version',
        environment: 'string_environment',
        database: 'object_database_config',
        features: 'object_features',
        logging: 'object_logging_config'
      },
      examples: [
        { app_name: 'MyApp', version: '1.0.0', environment: 'production', database: { host: 'localhost', port: 5432 }, features: { auth: true, analytics: false }, logging: { level: 'info', format: 'json' } }
      ],
      frequency: 'medium',
      confidence: 0.89
    });

    // Analytics patterns
    this.addPattern('analytics_page_view', {
      type: 'analytics',
      category: 'page_view',
      fields: ['session_id', 'user_id', 'page', 'timestamp', 'referrer', 'user_agent', 'duration'],
      structure: {
        session_id: 'string_uuid',
        user_id: 'string_uuid',
        page: 'string_url',
        timestamp: 'datetime',
        referrer: 'string_url',
        user_agent: 'string_user_agent',
        duration: 'number_seconds'
      },
      examples: [
        { session_id: 'sess-001', user_id: 'user-123', page: '/dashboard', timestamp: '2023-01-01T12:00:00Z', referrer: '/login', user_agent: 'Mozilla/5.0...', duration: 45 }
      ],
      frequency: 'high',
      confidence: 0.97
    });

    // API response patterns
    this.addPattern('api_response_success', {
      type: 'api_response',
      category: 'success',
      fields: ['status', 'data', 'message', 'timestamp', 'request_id'],
      structure: {
        status: 'string_status',
        data: 'object_response_data',
        message: 'string_message',
        timestamp: 'datetime',
        request_id: 'string_uuid'
      },
      examples: [
        { status: 'success', data: { id: 'user-123', name: 'John Doe' }, message: 'User retrieved successfully', timestamp: '2023-01-01T12:00:00Z', request_id: 'req-001' }
      ],
      frequency: 'high',
      confidence: 0.95
    });

    this.addPattern('api_response_error', {
      type: 'api_response',
      category: 'error',
      fields: ['status', 'error', 'message', 'timestamp', 'request_id'],
      structure: {
        status: 'string_status',
        error: 'string_error_code',
        message: 'string_message',
        timestamp: 'datetime',
        request_id: 'string_uuid'
      },
      examples: [
        { status: 'error', error: 'not_found', message: 'User not found', timestamp: '2023-01-01T12:00:00Z', request_id: 'req-002' }
      ],
      frequency: 'medium',
      confidence: 0.92
    });

    console.log(`[PATTERNS] Loaded ${this.patterns.size} default patterns`);
  }

  // Add a new pattern
  addPattern(name, pattern) {
    this.patterns.set(name, pattern);
    
    // Update classification
    if (!this.classifications.has(pattern.type)) {
      this.classifications.set(pattern.type, []);
    }
    this.classifications.get(pattern.type).push(name);
    
    // Update recommendations
    if (!this.recommendations.has(pattern.category)) {
      this.recommendations.set(pattern.category, []);
    }
    this.recommendations.get(pattern.category).push(name);
    
    console.log(`[PATTERNS] Added pattern: ${name} (${pattern.type}/${pattern.category})`);
  }

  // Detect pattern in data
  detectPattern(data, options = {}) {
    const { type = null, category = null, minConfidence = this.confidenceThreshold } = options;
    const results = [];

    for (const [patternName, pattern] of this.patterns) {
      // Filter by type if specified
      if (type && pattern.type !== type) continue;
      
      // Filter by category if specified
      if (category && pattern.category !== category) continue;
      
      const confidence = this.calculatePatternMatch(data, pattern);
      
      if (confidence >= minConfidence) {
        results.push({
          pattern: patternName,
          type: pattern.type,
          category: pattern.category,
          confidence,
          frequency: pattern.frequency,
          match: confidence >= 0.9 ? 'strong' : confidence >= 0.7 ? 'moderate' : 'weak'
        });
      }
    }

    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);

    return {
      matches: results,
      bestMatch: results[0] || null,
      totalMatches: results.length,
      timestamp: new Date().toISOString()
    };
  }

  // Calculate pattern match confidence
  calculatePatternMatch(data, pattern) {
    let score = 0;
    let totalChecks = 0;

    // Check type match
    if (this.validateDataType(data, pattern.type)) {
      score += 0.3;
    }
    totalChecks += 0.3;

    // Check field presence
    const fieldScore = this.calculateFieldMatch(data, pattern);
    score += fieldScore * 0.4;
    totalChecks += 0.4;

    // Check structure match
    const structureScore = this.calculateStructureMatch(data, pattern);
    score += structureScore * 0.3;
    totalChecks += 0.3;

    return totalChecks > 0 ? score / totalChecks : 0;
  }

  // Validate data type
  validateDataType(data, expectedType) {
    switch (expectedType) {
      case 'user':
      case 'product':
      case 'order':
      case 'event':
      case 'log':
      case 'config':
      case 'analytics':
      case 'api_response':
        return typeof data === 'object' && data !== null && !Array.isArray(data);
      case 'pattern':
        return typeof data === 'string';
      default:
        return true;
    }
  }

  // Calculate field match score
  calculateFieldMatch(data, pattern) {
    const dataFields = typeof data === 'object' && data !== null ? Object.keys(data) : [];
    const patternFields = pattern.fields || [];
    
    if (dataFields.length === 0 && patternFields.length === 0) {
      return 1;
    }
    
    if (dataFields.length === 0 || patternFields.length === 0) {
      return 0;
    }
    
    const intersection = dataFields.filter(field => patternFields.includes(field));
    const union = [...new Set([...dataFields, ...patternFields])];
    
    return intersection.length / union.length;
  }

  // Calculate structure match score
  calculateStructureMatch(data, pattern) {
    if (!pattern.structure || typeof data !== 'object' || data === null) {
      return 0.5; // Neutral score if no structure defined
    }

    let matches = 0;
    let totalChecks = 0;

    Object.entries(pattern.structure).forEach(([field, expectedType]) => {
      totalChecks++;
      
      if (data.hasOwnProperty(field)) {
        const actualValue = data[field];
        const actualType = this.getValueType(actualValue);
        
        if (this.typeMatches(actualType, expectedType)) {
          matches++;
        }
      }
    });

    return totalChecks > 0 ? matches / totalChecks : 0;
  }

  // Get value type
  getValueType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') {
      if (value.includes('@')) return 'string_email';
      if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$/)) return 'datetime';
      if (value.match(/^\d{4}-\d{2}-\d{2}$/)) return 'date';
      return 'string';
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number_decimal';
    }
    return typeof value;
  }

  // Check if types match
  typeMatches(actual, expected) {
    const typeMap = {
      'string': ['string', 'string_email', 'string_phone', 'string_url', 'string_name', 'string_product_name', 'string_description', 'string_message', 'string_status', 'string_category', 'string_currency', 'string_payment', 'string_source', 'string_event_type', 'string_log_level', 'string_app_name', 'string_version', 'string_environment', 'string_user_agent', 'string_url', 'string_uuid', 'string_error_code'],
      'number': ['number', 'integer', 'number_decimal'],
      'datetime': ['datetime', 'date'],
      'object': ['object', 'object_address', 'object_preferences', 'object_inventory', 'object_event_data', 'object_context', 'object_database_config', 'object_features', 'object_logging_config', 'object_response_data'],
      'array': ['array', 'array_string', 'array_order_items']
    };

    const expectedTypes = typeMap[expected] || [expected];
    return expectedTypes.includes(actual);
  }

  // Get patterns by type
  getPatternsByType(type) {
    return this.classifications.get(type) || [];
  }

  // Get patterns by category
  getPatternsByCategory(category) {
    return this.recommendations.get(category) || [];
  }

  // Get pattern details
  getPattern(name) {
    return this.patterns.get(name);
  }

  // List all patterns
  listPatterns() {
    return Array.from(this.patterns.keys());
  }

  // Validate pattern
  validatePattern(name, data) {
    const pattern = this.patterns.get(name);
    if (!pattern) {
      throw new Error(`Pattern not found: ${name}`);
    }

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      score: 0,
      matches: {}
    };

    // Check type
    if (!this.validateDataType(data, pattern.type)) {
      result.errors.push(`Type mismatch: expected ${pattern.type}, got ${typeof data}`);
      result.valid = false;
    }

    // Check fields
    const dataFields = typeof data === 'object' && data !== null ? Object.keys(data) : [];
    const patternFields = pattern.fields || [];
    
    const missingFields = patternFields.filter(field => !dataFields.includes(field));
    const extraFields = dataFields.filter(field => !patternFields.includes(field));

    if (missingFields.length > 0) {
      result.errors.push(`Missing fields: ${missingFields.join(', ')}`);
      result.valid = false;
    }

    if (extraFields.length > 0) {
      result.warnings.push(`Extra fields: ${extraFields.join(', ')}`);
    }

    // Calculate overall score
    result.score = this.calculatePatternMatch(data, pattern);

    return result;
  }

  // Generate data from pattern
  generateFromPattern(name, options = {}) {
    const pattern = this.patterns.get(name);
    if (!pattern) {
      throw new Error(`Pattern not found: ${name}`);
    }

    const data = {};
    
    // Generate fields based on pattern structure
    if (pattern.structure) {
      Object.entries(pattern.structure).forEach(([field, type]) => {
        data[field] = this.generateValueByType(field, type, options);
      });
    }

    return data;
  }

  // Generate value by type
  generateValueByType(field, type, options = {}) {
    const { locale = 'en-US', seed = null } = options;
    
    switch (type) {
      case 'string_uuid':
        return this.generateUUID();
      case 'string_name':
        return this.generateName(locale);
      case 'string_email':
        return this.generateEmail();
      case 'string_phone':
        return this.generatePhone();
      case 'string_url':
        return this.generateURL();
      case 'string_product_name':
        return this.generateProductName();
      case 'string_description':
        return this.generateDescription();
      case 'string_message':
        return this.generateMessage();
      case 'string_status':
        return this.generateStatus();
      case 'string_category':
        return this.generateCategory();
      case 'string_currency':
        return this.generateCurrency();
      case 'string_payment':
        return this.generatePaymentMethod();
      case 'string_source':
        return this.generateSource();
      case 'string_event_type':
        return this.generateEventType();
      case 'string_log_level':
        return this.generateLogLevel();
      case 'string_app_name':
        return this.generateAppName();
      case 'string_version':
        return this.generateVersion();
      case 'string_environment':
        return this.generateEnvironment();
      case 'string_user_agent':
        return this.generateUserAgent();
      case 'string_error_code':
        return this.generateErrorCode();
      case 'datetime':
        return new Date().toISOString();
      case 'date':
        return new Date().toISOString().split('T')[0];
      case 'number_decimal':
        return Math.round(Math.random() * 1000 * 100) / 100;
      case 'integer':
        return Math.floor(Math.random() * 1000);
      case 'object_address':
        return this.generateAddress();
      case 'object_preferences':
        return this.generatePreferences();
      case 'object_inventory':
        return this.generateInventory();
      case 'object_event_data':
        return this.generateEventData();
      case 'object_context':
        return this.generateContext();
      case 'object_database_config':
        return this.generateDatabaseConfig();
      case 'object_features':
        return this.generateFeatures();
      case 'object_logging_config':
        return this.generateLoggingConfig();
      case 'object_response_data':
        return this.generateResponseData();
      case 'array_string':
        return [this.generateString(), this.generateString(), this.generateString()];
      case 'array_order_items':
        return [this.generateOrderItem(), this.generateOrderItem()];
      default:
        return null;
    }
  }

  // Value generation helpers
  generateUUID() {
    return 'uuid-' + Math.random().toString(36).substr(2, 9);
  }

  generateName(locale = 'en-US') {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    
    return firstNames[Math.floor(Math.random() * firstNames.length)] + ' ' + lastNames[Math.floor(Math.random() * lastNames.length)];
  }

  generateEmail() {
    const domains = ['example.com', 'test.com', 'demo.com', 'sample.com'];
    const names = ['john', 'jane', 'mike', 'sarah', 'bob', 'alice'];
    
    return names[Math.floor(Math.random() * names.length)] + '@' + domains[Math.floor(Math.random() * domains.length)];
  }

  generatePhone() {
    return '+1-555-' + Math.floor(Math.random() * 900 + 100).toString().padStart(3, '0') + '-' + Math.floor(Math.random() * 9000 + 1000).toString().padStart(4, '0');
  }

  generateURL() {
    const protocols = ['http', 'https'];
    const domains = ['example.com', 'test.com', 'api.example.com'];
    const paths = ['/api/v1/users', '/products', '/orders', '/events', '/logs'];
    
    return protocols[Math.floor(Math.random() * protocols.length)] + '://' + domains[Math.floor(Math.random() * domains.length)] + paths[Math.floor(Math.random() * paths.length)];
  }

  generateProductName() {
    const adjectives = ['Wireless', 'Mechanical', 'Digital', 'Smart', 'Portable', 'Professional'];
    const products = ['Mouse', 'Keyboard', 'Monitor', 'Laptop', 'Headphones', 'Camera', 'Speaker', 'Router'];
    
    return adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' + products[Math.floor(Math.random() * products.length)];
  }

  generateDescription() {
    const descriptions = [
      'High-quality product with advanced features',
      'Essential item for everyday use',
      'Premium quality with excellent performance',
      'Reliable and durable construction',
      'Innovative design with modern technology'
    ];
    
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  generateMessage() {
    const messages = [
      'Operation completed successfully',
      'Request processed without errors',
      'Data validated and stored',
      'Authentication successful',
      'System update completed'
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }

  generateStatus() {
    const statuses = ['active', 'inactive', 'pending', 'processing', 'completed', 'cancelled', 'failed'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  generateCategory() {
    const categories = ['Electronics', 'Clothing', 'Books', 'Home', 'Sports', 'Toys', 'Food', 'Health'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  generateCurrency() {
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
    return currencies[Math.floor(Math.random() * currencies.length)];
  }

  generatePaymentMethod() {
    const methods = ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash'];
    return methods[Math.floor(Math.random() * methods.length)];
  }

  generateSource() {
    const sources = ['web_app', 'mobile_app', 'api', 'system', 'external_service'];
    return sources[Math.floor(Math.random() * sources.length)];
  }

  generateEventType() {
    const types = ['user_action', 'system_event', 'api_call', 'error', 'warning', 'info'];
    return types[Math.floor(Math.random() * types.length)];
  }

  generateLogLevel() {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  generateAppName() {
    const names = ['MyApp', 'TestApp', 'DemoApp', 'SampleApp', 'Prototype'];
    return names[Math.floor(Math.random() * names.length)];
  }

  generateVersion() {
    return '1.' + Math.floor(Math.random() * 9) + '.' + Math.floor(Math.random() * 9);
  }

  generateEnvironment() {
    const environments = ['development', 'testing', 'staging', 'production'];
    return environments[Math.floor(Math.random() * environments.length)];
  }

  generateUserAgent() {
    const agents = ['Mozilla/5.0', 'Chrome/91.0', 'Safari/14.0', 'Firefox/89.0'];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  generateErrorCode() {
    const codes = ['not_found', 'invalid_request', 'server_error', 'unauthorized', 'forbidden'];
    return codes[Math.floor(Math.random() * codes.length)];
  }

  generateAddress() {
    return {
      street: Math.floor(Math.random() * 999) + ' Main St',
      city: 'Springfield',
      state: 'IL',
      country: 'USA',
      zip: Math.floor(Math.random() * 90000 + 10000).toString()
    };
  }

  generatePreferences() {
    return {
      theme: Math.random() > 0.5 ? 'dark' : 'light',
      notifications: Math.random() > 0.5,
      language: 'en',
      timezone: 'UTC'
    };
  }

  generateInventory() {
    return {
      available: Math.floor(Math.random() * 100) + 1,
      reserved: Math.floor(Math.random() * 10),
      warehouse_location: 'Main Warehouse'
    };
  }

  generateEventData() {
    return {
      action: this.generateEventType(),
      details: 'Additional event information'
    };
  }

  generateContext() {
    return {
      ip_address: '192.168.1.' + Math.floor(Math.random() * 254 + 1),
      user_agent: this.generateUserAgent(),
      session_id: this.generateUUID()
    };
  }

  generateDatabaseConfig() {
    return {
      host: 'localhost',
      port: 5432,
      database: 'myapp_db',
      username: 'user',
      password: 'password'
    };
  }

  generateFeatures() {
    return {
      authentication: Math.random() > 0.5,
      analytics: Math.random() > 0.5,
      notifications: Math.random() > 0.5,
      api_access: Math.random() > 0.5
    };
  }

  generateLoggingConfig() {
    return {
      level: 'info',
      format: 'json',
      file: 'app.log',
      console: true
    };
  }

  generateResponseData() {
    return {
      id: this.generateUUID(),
      name: this.generateName(),
      status: 'active'
    };
  }

  generateOrderItem() {
    return {
      product_id: this.generateUUID(),
      quantity: Math.floor(Math.random() * 5) + 1,
      price: Math.round(Math.random() * 1000 * 100) / 100
    };
  }

  generateString() {
    const strings = ['sample', 'test', 'demo', 'example', 'default'];
    return strings[Math.floor(Math.random() * strings.length)];
  }

  // Get pattern statistics
  getStats() {
    const stats = {
      totalPatterns: this.patterns.size,
      types: {},
      categories: {},
      averageConfidence: 0,
      highFrequencyPatterns: 0
    };

    this.patterns.forEach(pattern => {
      stats.types[pattern.type] = (stats.types[pattern.type] || 0) + 1;
      stats.categories[pattern.category] = (stats.categories[pattern.category] || 0) + 1;
      stats.averageConfidence += pattern.confidence;
      
      if (pattern.frequency === 'high') {
        stats.highFrequencyPatterns++;
      }
    });

    if (this.patterns.size > 0) {
      stats.averageConfidence = stats.averageConfidence / this.patterns.size;
    }

    return stats;
  }

  // Export patterns
  exportPatterns() {
    const patterns = {};
    
    this.patterns.forEach((pattern, name) => {
      patterns[name] = pattern;
    });
    
    return {
      patterns,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      stats: this.getStats()
    };
  }

  // Import patterns
  importPatterns(patternsData) {
    if (patternsData.patterns) {
      Object.entries(patternsData.patterns).forEach(([name, pattern]) => {
        this.addPattern(name, pattern);
      });
    }
    
    console.log(`[PATTERNS] Imported ${Object.keys(patternsData.patterns || {}).length} patterns`);
  }
}

module.exports = PatternLibrary;
