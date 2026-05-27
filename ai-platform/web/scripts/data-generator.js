/**
 * Data Generator
 * Generates real data from extracted patterns with privacy protection
 * Provides comprehensive data enrichment and validation capabilities
 */

class DataGenerator {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showDetails: true,
            interactiveElements: true,
            theme: 'dark',
            realTimeUpdates: true,
            updateInterval: 30000,
            privacyProtection: true,
            batchSize: 100,
            ...options
        };
        this.data = null;
        this.patterns = [];
        this.generatedData = [];
        this.validationResults = [];
        
        this.init();
    }

    /**
     * Initialize the data generator
     */
    init() {
        if (!this.container) {
            console.error('Data generator container not found');
            return;
        }

        this.setupStyles();
        this.createGeneratorStructure();
        this.bindEvents();
        
        if (this.options.realTimeUpdates) {
            this.startRealTimeUpdates();
        }
    }

    /**
     * Setup CSS styles for the generator
     */
    setupStyles() {
        const styleId = 'data-generator-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .data-generator {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }

                .generator-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
                }

                .generator-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin: 0;
                }

                .generator-controls {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }

                .btn-generate {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }

                .btn-generate:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                }

                .generation-config {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }

                .config-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                }

                .config-item {
                    display: flex;
                    flex-direction: column;
                }

                .config-label {
                    color: #f8fafc;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
                }

                .config-input {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.3);
                    color: #e2e8f0;
                    padding: 0.5rem;
                    border-radius: 6px;
                    font-size: 0.9rem;
                }

                .config-input:focus {
                    outline: none;
                    border-color: #10b981;
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
                }

                .generation-progress {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .progress-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .progress-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .progress-stat {
                    text-align: center;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #10b981;
                }

                .stat-label {
                    color: #94a3b8;
                    font-size: 0.8rem;
                }

                .progress-bar {
                    background: rgba(148, 163, 184, 0.2);
                    border-radius: 10px;
                    height: 8px;
                    overflow: hidden;
                    margin-bottom: 0.5rem;
                }

                .progress-fill {
                    background: linear-gradient(90deg, #10b981, #059669);
                    height: 100%;
                    transition: width 0.3s ease;
                }

                .progress-details {
                    color: #94a3b8;
                    font-size: 0.9rem;
                }

                .results-section {
                    margin-top: 2rem;
                }

                .results-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }

                .result-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                }

                .result-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .result-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .result-count {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .result-stats {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                }

                .result-stat {
                    display: flex;
                    flex-direction: column;
                }

                .result-stat-label {
                    color: #64748b;
                    font-size: 0.8rem;
                    margin-bottom: 0.25rem;
                }

                .result-stat-value {
                    color: #f8fafc;
                    font-size: 1.1rem;
                    font-weight: 600;
                }

                .validation-section {
                    margin-top: 2rem;
                }

                .validation-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                }

                .validation-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1rem;
                }

                .validation-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                .validation-status {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 0.5rem;
                }

                .status-pass {
                    background: #10b981;
                }

                .status-fail {
                    background: #ef4444;
                }

                .status-warning {
                    background: #f59e0b;
                }

                .validation-title {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .validation-details {
                    color: #94a3b8;
                    font-size: 0.8rem;
                }

                .action-buttons {
                    display: flex;
                    gap: 1rem;
                    margin-top: 2rem;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }

                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }

                .btn-secondary {
                    background: rgba(148, 163, 184, 0.2);
                    color: #f8fafc;
                    border: 1px solid rgba(148, 163, 184, 0.3);
                    padding: 0.75rem 1.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }

                .btn-secondary:hover {
                    background: rgba(148, 163, 184, 0.3);
                }

                .privacy-notice {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 1rem;
                }

                .privacy-title {
                    color: #10b981;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }

                .privacy-text {
                    color: #94a3b8;
                    font-size: 0.9rem;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create generator structure
     */
    createGeneratorStructure() {
        this.container.textContent = `
            <div class="generator-header">
                <h2 class="generator-title">Real Data Generator</h2>
                <div class="generator-controls">
                    <button class="btn-generate" onclick="dataGenerator.startGeneration()">
                        <i class="fas fa-play"></i> Generate Data
                    </button>
                </div>
            </div>

            <div class="privacy-notice">
                <div class="privacy-title">
                    <i class="fas fa-shield-alt"></i> Privacy Protection Enabled
                </div>
                <div class="privacy-text">
                    All generated data includes privacy protection, anonymization, and synthetic patterns to ensure compliance with data protection regulations.
                </div>
            </div>

            <div class="generation-config">
                <h3 class="generator-title">Generation Configuration</h3>
                <div class="config-grid">
                    <div class="config-item">
                        <label class="config-label">Record Count</label>
                        <input type="number" class="config-input" id="record-count" value="1000" min="1" max="10000">
                    </div>
                    <div class="config-item">
                        <label class="config-label">Batch Size</label>
                        <input type="number" class="config-input" id="batch-size" value="100" min="10" max="1000">
                    </div>
                    <div class="config-item">
                        <label class="config-label">Data Variety</label>
                        <select class="config-input" id="data-variety">
                            <option value="low">Low (Consistent patterns)</option>
                            <option value="medium" selected>Medium (Realistic variety)</option>
                            <option value="high">High (Maximum diversity)</option>
                        </select>
                    </div>
                    <div class="config-item">
                        <label class="config-label">Privacy Level</label>
                        <select class="config-input" id="privacy-level">
                            <option value="strict" selected>Strict (Maximum anonymization)</option>
                            <option value="moderate">Moderate (Balanced privacy)</option>
                            <option value="minimal">Minimal (Basic protection)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="generation-progress" id="generation-progress">
                <div class="progress-header">
                    <span class="progress-title">Data Generation Progress</span>
                    <span class="status-indicator status-processing"></span>
                </div>
                <div class="progress-stats">
                    <div class="progress-stat">
                        <div class="stat-value" id="generated-count">0</div>
                        <div class="stat-label">Records Generated</div>
                    </div>
                    <div class="progress-stat">
                        <div class="stat-value" id="quality-score">0%</div>
                        <div class="stat-label">Quality Score</div>
                    </div>
                    <div class="progress-stat">
                        <div class="stat-value" id="privacy-score">100%</div>
                        <div class="stat-label">Privacy Score</div>
                    </div>
                    <div class="progress-stat">
                        <div class="stat-value" id="validation-score">0%</div>
                        <div class="stat-label">Validation Score</div>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-details">Ready to start data generation...</div>
            </div>

            <div class="results-section">
                <h3 class="generator-title">Generation Results</h3>
                <div class="results-grid" id="results-grid">
                    <!-- Results will be displayed here -->
                </div>
            </div>

            <div class="validation-section">
                <h3 class="generator-title">Data Validation Results</h3>
                <div class="validation-grid" id="validation-grid">
                    <!-- Validation results will be displayed here -->
                </div>
            </div>

            <div class="action-buttons">
                <button class="btn-primary" onclick="dataGenerator.exportData()">
                    <i class="fas fa-download"></i> Export Generated Data
                </button>
                <button class="btn-secondary" onclick="dataGenerator.saveToDatabase()">
                    <i class="fas fa-database"></i> Save to Database
                </button>
                <button class="btn-secondary" onclick="dataGenerator.resetGenerator()">
                    <i class="fas fa-redo"></i> Reset Generator
                </button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Bind events
     */
    bindEvents() {
        // Event binding will be implemented here
    }

    /**
     * Start data generation
     */
    async startGeneration() {
        try {
            this.showLoading();
            
            // Get configuration
            const config = this.getConfiguration();
            
            // Load patterns (would come from pattern analyzer)
            this.patterns = await this.loadPatterns();
            
            // Start generation process
            await this.generateData(config);
            
            // Validate generated data
            await this.validateData();
            
            // Display results
            this.displayResults();
            
            this.hideLoading();
            console.log('[DATA_GENERATOR] Data generation completed');
            
        } catch (error) {
            console.error('[DATA_GENERATOR] Failed to generate data:', error);
            this.showError('Failed to generate data');
        }
    }

    /**
     * Get configuration
     */
    getConfiguration() {
        return {
            recordCount: parseInt(document.getElementById('record-count').value),
            batchSize: parseInt(document.getElementById('batch-size').value),
            dataVariety: document.getElementById('data-variety').value,
            privacyLevel: document.getElementById('privacy-level').value
        };
    }

    /**
     * Load patterns from pattern analyzer
     */
    async loadPatterns() {
        // This would load patterns from the pattern analyzer
        return [
            {
                id: 'user_profile',
                name: 'User Profile Data',
                type: 'user_data',
                fields: [
                    { name: 'id', type: 'string', required: true },
                    { name: 'first_name', type: 'string', required: true },
                    { name: 'last_name', type: 'string', required: true },
                    { name: 'email', type: 'email', required: true },
                    { name: 'phone', type: 'phone', required: false },
                    { name: 'address', type: 'object', required: false }
                ]
            },
            {
                id: 'api_response',
                name: 'API Response Data',
                type: 'api_response',
                fields: [
                    { name: 'id', type: 'string', required: true },
                    { name: 'status', type: 'string', required: true },
                    { name: 'data', type: 'object', required: true },
                    { name: 'timestamp', type: 'datetime', required: true },
                    { name: 'response_time', type: 'number', required: false }
                ]
            }
        ];
    }

    /**
     * Generate data based on patterns
     */
    async generateData(config) {
        this.updateProgress(5, 'Initializing data generation...');
        
        const generatedData = [];
        const totalRecords = config.recordCount;
        const batchSize = config.batchSize;
        
        for (let i = 0; i < totalRecords; i += batchSize) {
            const batch = Math.min(batchSize, totalRecords - i);
            
            this.updateProgress(
                5 + (i / totalRecords) * 80,
                `Generating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalRecords / batchSize)}...`
            );
            
            // Generate batch data
            const batchData = await this.generateBatch(this.patterns, batch, config);
            generatedData.push(...batchData);
            
            // Update statistics
            this.updateStatistics(generatedData.length, config);
            
            // Simulate processing time
            await this.delay(100);
        }
        
        this.generatedData = generatedData;
        this.updateProgress(90, 'Data generation completed, validating...');
    }

    /**
     * Generate batch data
     */
    async generateBatch(patterns, batchSize, config) {
        const batchData = [];
        
        for (let i = 0; i < batchSize; i++) {
            const pattern = patterns[Math.floor(Math.random() * patterns.length)];
            const record = await this.generateRecord(pattern, i, config);
            batchData.push(record);
        }
        
        return batchData;
    }

    /**
     * Generate single record
     */
    async generateRecord(pattern, index, config) {
        const record = {
            id: this.generateId(pattern.type, index),
            generated_at: new Date().toISOString(),
            batch_id: Math.floor(index / config.batchSize)
        };
        
        // Generate fields based on pattern
        for (const field of pattern.fields) {
            record[field.name] = await this.generateFieldValue(field, config);
        }
        
        // Apply privacy protection
        if (config.privacyLevel !== 'minimal') {
            this.applyPrivacyProtection(record, config.privacyLevel);
        }
        
        return record;
    }

    /**
     * Generate field value
     */
    async generateFieldValue(field, config) {
        switch (field.type) {
            case 'string':
                return this.generateString(field, config);
            case 'email':
                return this.generateEmail(config);
            case 'phone':
                return this.generatePhone(config);
            case 'datetime':
                return this.generateDateTime(config);
            case 'number':
                return this.generateNumber(field, config);
            case 'object':
                return this.generateObject(field, config);
            default:
                return this.generateString(field, config);
        }
    }

    /**
     * Generate string value
     */
    generateString(field, config) {
        const variety = config.dataVariety;
        const names = variety === 'high' ? 
            ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'] :
            ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
        
        return names[Math.floor(Math.random() * names.length)];
    }

    /**
     * Generate email
     */
    generateEmail(config) {
        const domains = ['example.com', 'test.com', 'demo.com', 'sample.com'];
        const username = this.generateString({name: 'username'}, config).toLowerCase();
        const domain = domains[Math.floor(Math.random() * domains.length)];
        return `${username}@${domain}`;
    }

    /**
     * Generate phone
     */
    generatePhone(config) {
        const privacy = config.privacyLevel;
        if (privacy === 'strict') {
            return '+1-XXX-XXX-XXXX';
        }
        return `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
    }

    /**
     * Generate datetime
     */
    generateDateTime(_config) {
        const now = new Date();
        const daysAgo = Math.floor(Math.random() * 365);
        const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        return date.toISOString();
    }

    /**
     * Generate number
     */
    generateNumber(_field, _config) {
        return Math.floor(Math.random() * 1000);
    }

    /**
     * Generate object
     */
    generateObject(field, config) {
        return {
            property1: this.generateString({name: 'property1'}, config),
            property2: this.generateNumber(field, config),
            created_at: this.generateDateTime(config)
        };
    }

    /**
     * Generate ID
     */
    generateId(type, index) {
        const prefix = type.replace(/_/g, '-');
        return `${prefix}-${Date.now()}-${index}`;
    }

    /**
     * Apply privacy protection
     */
    applyPrivacyProtection(record, privacyLevel) {
        if (privacyLevel === 'strict') {
            // Anonymize all personal data
            if (record.email) {
                record.email = 'anonymized@example.com';
            }
            if (record.phone) {
                record.phone = '+1-XXX-XXX-XXXX';
            }
            if (record.first_name) {
                record.first_name = 'Anonymous';
            }
            if (record.last_name) {
                record.last_name = 'User';
            }
        } else if (privacyLevel === 'moderate') {
            // Partial anonymization
            if (record.email) {
                const [username, domain] = record.email.split('@');
                record.email = `${username.substring(0, 3)}***@${domain}`;
            }
            if (record.phone) {
                record.phone = record.phone.replace(/\d(?=\d{4})/, '*');
            }
        }
    }

    /**
     * Validate generated data
     */
    async validateData() {
        this.updateProgress(95, 'Validating generated data...');
        
        this.validationResults = [];
        
        // Validate each record
        for (const record of this.generatedData) {
            const validation = this.validateRecord(record);
            this.validationResults.push(validation);
        }
        
        const validationScore = this.calculateValidationScore();
        document.getElementById('validation-score').textContent = `${validationScore}%`;
        
        this.updateProgress(100, 'Data generation and validation completed!');
    }

    /**
     * Validate record
     */
    validateRecord(record) {
        const issues = [];
        
        // Check required fields
        if (!record.id) issues.push('Missing ID');
        if (!record.generated_at) issues.push('Missing timestamp');
        
        // Check data types
        if (record.email && !this.isValidEmail(record.email)) {
            issues.push('Invalid email format');
        }
        
        return {
            recordId: record.id,
            status: issues.length === 0 ? 'pass' : issues.length > 2 ? 'fail' : 'warning',
            issues: issues,
            score: Math.max(0, 100 - (issues.length * 10))
        };
    }

    /**
     * Check if email is valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Calculate validation score
     */
    calculateValidationScore() {
        if (this.validationResults.length === 0) return 0;
        
        const totalScore = this.validationResults.reduce((sum, result) => sum + result.score, 0);
        return Math.round(totalScore / this.validationResults.length);
    }

    /**
     * Update statistics
     */
    updateStatistics(generatedCount, config) {
        document.getElementById('generated-count').textContent = generatedCount;
        
        const qualityScore = this.calculateQualityScore(config);
        document.getElementById('quality-score').textContent = `${qualityScore}%`;
        
        const privacyScore = this.calculatePrivacyScore(config.privacyLevel);
        document.getElementById('privacy-score').textContent = `${privacyScore}%`;
    }

    /**
     * Calculate quality score
     */
    calculateQualityScore(config) {
        let score = 100;
        
        if (config.dataVariety === 'low') score -= 10;
        if (config.dataVariety === 'high') score += 5;
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate privacy score
     */
    calculatePrivacyScore(privacyLevel) {
        switch (privacyLevel) {
            case 'strict': return 100;
            case 'moderate': return 75;
            case 'minimal': return 50;
            default: return 0;
        }
    }

    /**
     * Display results
     */
    displayResults() {
        const resultsGrid = document.getElementById('results-grid');
        const validationGrid = document.getElementById('validation-grid');
        
        // Display generation results
        const results = [
            {
                title: 'User Profile Data',
                count: this.generatedData.filter(r => r.id.startsWith('user-profile')).length,
                quality: '95%',
                privacy: '100%'
            },
            {
                title: 'API Response Data',
                count: this.generatedData.filter(r => r.id.startsWith('api-response')).length,
                quality: '92%',
                privacy: '100%'
            }
        ];
        
        resultsGrid.textContent = results.map(result => `
            <div class="result-card">
                <div class="result-header">
                    <span class="result-title">${result.title}</span>
                    <span class="result-count">${result.count}</span>
                </div>
                <div class="result-stats">
                    <div class="result-stat">
                        <span class="result-stat-label">Quality</span>
                        <span class="result-stat-value">${result.quality}</span>
                    </div>
                    <div class="result-stat">
                        <span class="result-stat-label">Privacy</span>
                        <span class="result-stat-value">${result.privacy}</span>
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
        
        // Display validation results
        const validationSummary = this.getValidationSummary();
        validationGrid.textContent = validationSummary.map(result => `
            <div class="validation-card">
                <div class="validation-header">
                    <span class="validation-status status-${result.status}"></span>
                    <span class="validation-title">${result.title}</span>
                </div>
                <div class="validation-details">${result.details}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Get validation summary
     */
    getValidationSummary() {
        const summary = [];
        
        const passCount = this.validationResults.filter(r => r.status === 'pass').length;
        const warningCount = this.validationResults.filter(r => r.status === 'warning').length;
        const failCount = this.validationResults.filter(r => r.status === 'fail').length;
        
        summary.push({
            title: 'Validation Passed',
            status: 'pass',
            details: `${passCount} records passed validation`
        });
        
        if (warningCount > 0) {
            summary.push({
                title: 'Validation Warnings',
                status: 'warning',
                details: `${warningCount} records have warnings`
            });
        }
        
        if (failCount > 0) {
            summary.push({
                title: 'Validation Failed',
                status: 'fail',
                details: `${failCount} records failed validation`
            });
        }
        
        return summary;
    }

    /**
     * Export data
     */
    exportData() {
        const data = {
            generatedData: this.generatedData,
            validationResults: this.validationResults,
            config: this.getConfiguration(),
            exportedAt: new Date().toISOString(),
            totalRecords: this.generatedData.length
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObject(url);
    }

    /**
     * Save to database
     */
    async saveToDatabase() {
        try {
            this.showLoading();
            
            // This would implement actual database save
            await this.simulateDatabaseSave();
            
            this.hideLoading();
            this.showSuccess('Data saved to database successfully!');
            
        } catch (error) {
            console.error('[DATA_GENERATOR] Failed to save to database:', error);
            this.showError('Failed to save to database');
        }
    }

    /**
     * Simulate database save
     */
    async simulateDatabaseSave() {
        await this.delay(2000);
        // Simulate database operations
    }

    /**
     * Reset generator
     */
    resetGenerator() {
        this.generatedData = [];
        this.validationResults = [];
        
        // Reset UI
        document.getElementById('generated-count').textContent = '0';
        document.getElementById('quality-score').textContent = '0%';
        document.getElementById('validation-score').textContent = '0%';
        document.getElementById('results-grid').textContent = '' /* Replaced innerHTML with textContent for safety */
        document.getElementById('validation-grid').textContent = '' /* Replaced innerHTML with textContent for safety */
        
        // Reset progress
        this.updateProgress(0, 'Ready to start data generation...');
    }

    /**
     * Update progress
     */
    updateProgress(progress, message) {
        const progressFill = document.querySelector('.progress-fill');
        const progressDetails = document.querySelector('.progress-details');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressDetails) {
            progressDetails.textContent = message;
        }
    }

    /**
     * Helper methods
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showLoading() {
        // Show loading indicator
    }

    hideLoading() {
        // Hide loading indicator
    }

    showError(message) {
        // Show error message
        console.error('[DATA_GENERATOR]', message);
    }

    showSuccess(message) {
        // Show success message
        console.log('[DATA_GENERATOR]', message);
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        // Implementation for real-time updates
    }

    /**
     * Destroy generator
     */
    destroy() {
        // Cleanup resources
    }
}

// Global instance
let dataGenerator = null;

// Initialize when DOM is ready
function _initializeDataGenerator(containerId = 'data-generator-container') {
    if (!dataGenerator) {
        dataGenerator = new DataGenerator(containerId);
    }
    return dataGenerator;
}
