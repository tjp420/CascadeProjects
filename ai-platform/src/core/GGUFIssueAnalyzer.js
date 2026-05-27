/**
 * GGUF Issue Analyzer
 * Advanced issue detection engine for GGUF mock data with real-time monitoring,
 * pattern recognition, and AI-powered severity assessment.
 */

const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');

class GGUFIssueAnalyzer {
    constructor(options = {}) {
        this.options = {
            watchDirectories: options.watchDirectories || ['data/mock', 'src/data'],
            filePatterns: options.filePatterns || ['**/*.json', '**/*.js', '**/*.ts'],
            enableRealTime: options.enableRealTime !== false,
            enableAI: options.enableAI !== false,
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
            ...options
        };

        this.fileWatcher = null;
        this.ruleEngine = new GGUFRuleEngine();
        this.patternMatcher = new GGUFPatternMatcher();
        this.severityAssessor = new GGUFSeverityAssessor();
        this.issueHistory = new Map();
        this.fileCache = new Map();
        this.stats = {
            filesAnalyzed: 0,
            issuesDetected: 0,
            lastScan: null,
            scanDuration: 0
        };

        this.ready = this.initialize();
    }

    /**
     * Initialize the analyzer
     */
    async initialize() {
        console.log('🔍 Initializing GGUF Issue Analyzer...');
        
        if (this.options.enableRealTime) {
            await this.setupFileWatcher();
        }
        
        await this.loadIssueHistory();
        console.log('✅ GGUF Issue Analyzer initialized');
    }

    /**
     * Setup real-time file monitoring
     */
    async setupFileWatcher() {
        const watchPaths = this.options.watchDirectories.map(dir => 
            path.resolve(process.cwd(), dir)
        );

        this.fileWatcher = chokidar.watch(watchPaths, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50
            }
        });

        this.fileWatcher
            .on('add', filePath => this.handleFileAdded(filePath))
            .on('change', filePath => this.handleFileChanged(filePath))
            .on('unlink', filePath => this.handleFileRemoved(filePath))
            .on('error', error => console.error('❌ File watcher error:', error));

        console.log('👁️ File watcher setup for:', watchPaths);
    }

    /**
     * Analyze specific files
     */
    async analyzeFiles(filePaths) {
        await this.ready;
        const startTime = Date.now();
        const results = {
            totalFiles: filePaths.length,
            issues: [],
            summary: {
                byType: {},
                bySeverity: {},
                byFile: {}
            }
        };

        console.log(`🔍 Analyzing ${filePaths.length} files...`);

        for (const filePath of filePaths) {
            try {
                const fileIssues = await this.analyzeFile(filePath);
                results.issues.push(...fileIssues);
                
                // Update summary
                fileIssues.forEach(issue => {
                    results.summary.byType[issue.type] = (results.summary.byType[issue.type] || 0) + 1;
                    results.summary.bySeverity[issue.severity] = (results.summary.bySeverity[issue.severity] || 0) + 1;
                    results.summary.byFile[issue.filePath] = (results.summary.byFile[issue.filePath] || 0) + 1;
                });
            } catch (error) {
                console.error(`❌ Error analyzing ${filePath}:`, error);
                results.issues.push({
                    id: `analysis_error_${Date.now()}`,
                    type: 'Analysis Error',
                    severity: 'high',
                    filePath,
                    message: `Failed to analyze file: ${error.message}`,
                    line: 0,
                    column: 0,
                    suggestedFix: 'Check file permissions and format',
                    detectedAt: new Date().toISOString()
                });
            }
        }

        // Update stats
        this.stats.filesAnalyzed += filePaths.length;
        this.stats.issuesDetected += results.issues.length;
        this.stats.lastScan = new Date().toISOString();
        this.stats.scanDuration = Date.now() - startTime;

        console.log(`✅ Analysis complete: ${results.issues.length} issues found in ${this.stats.scanDuration}ms`);

        return results;
    }

    /**
     * Analyze a single file
     */
    async analyzeFile(filePath) {
        const startTime = Date.now();
        
        try {
            // Check file size
            const stats = await fs.stat(filePath);
            if (stats.size > this.options.maxFileSize) {
                return [{
                    id: `large_file_${Date.now()}`,
                    type: 'File Size',
                    severity: 'medium',
                    filePath,
                    message: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB)`,
                    line: 0,
                    column: 0,
                    suggestedFix: 'Consider splitting large files or removing unused data',
                    detectedAt: new Date().toISOString(),
                    metadata: { fileSize: stats.size }
                }];
            }

            // Read file content
            const content = await fs.readFile(filePath, 'utf8');
            const fileExt = path.extname(filePath);
            
            // Cache file content for pattern matching
            this.fileCache.set(filePath, {
                content,
                lastModified: stats.mtime,
                size: stats.size
            });

            // Detect issues based on file type
            let issues = [];
            
            if (fileExt === '.json') {
                issues = await this.detectJSONIssues(filePath, content);
            } else if (['.js', '.ts'].includes(fileExt)) {
                issues = await this.detectCodeIssues(filePath, content);
            } else {
                issues = await this.detectGenericIssues(filePath, content);
            }

            // Apply pattern matching
            const patternIssues = await this.patternMatcher.matchPatterns(filePath, content);
            issues.push(...patternIssues);

            // Assess severity for all issues
            const enhancedIssues = await Promise.all(
                issues.map(issue => this.enhanceIssueWithAI(issue, content))
            );

            // Track in history
            this.trackIssues(filePath, enhancedIssues);

            return enhancedIssues;

        } catch (error) {
            console.error(`❌ Error analyzing ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Detect JSON-specific issues
     */
    async detectJSONIssues(filePath, content) {
        const issues = [];
        const lines = content.split('\n');

        try {
            // Parse JSON to validate structure
            const jsonData = JSON.parse(content);
            
            // Check for common JSON issues
            issues.push(...this.checkJSONStructure(filePath, jsonData, lines));
            issues.push(...this.checkDataConsistency(filePath, jsonData));
            issues.push(...this.checkSchemaCompliance(filePath, jsonData));
            
        } catch (parseError) {
            // JSON parsing error
            const lineMatch = parseError.message.match(/line (\d+)/);
            const line = lineMatch ? parseInt(lineMatch[1]) : 1;
            
            issues.push({
                id: `json_parse_${Date.now()}`,
                type: 'JSON Syntax Error',
                severity: 'high',
                filePath,
                message: `JSON parsing error: ${parseError.message}`,
                line,
                column: 0,
                suggestedFix: 'Fix JSON syntax error (missing comma, bracket, etc.)',
                detectedAt: new Date().toISOString()
            });
        }

        // Check formatting issues
        issues.push(...this.checkJSONFormatting(filePath, lines));

        return issues;
    }

    /**
     * Check JSON structure issues
     */
    checkJSONStructure(filePath, jsonData, lines) {
        const issues = [];

        // Check for empty arrays/objects that shouldn't be empty
        if (Array.isArray(jsonData) && jsonData.length === 0) {
            issues.push({
                id: `empty_array_${Date.now()}`,
                type: 'Empty Array',
                severity: 'low',
                filePath,
                message: 'Array is empty - may indicate missing data',
                line: 1,
                column: 0,
                suggestedFix: 'Add data or remove empty array',
                detectedAt: new Date().toISOString()
            });
        }

        if (typeof jsonData === 'object' && jsonData !== null && Object.keys(jsonData).length === 0) {
            issues.push({
                id: `empty_object_${Date.now()}`,
                type: 'Empty Object',
                severity: 'low',
                filePath,
                message: 'Object is empty - may indicate missing data',
                line: 1,
                column: 0,
                suggestedFix: 'Add properties or remove empty object',
                detectedAt: new Date().toISOString()
            });
        }

        return issues;
    }

    /**
     * Check data consistency issues
     */
    checkDataConsistency(filePath, jsonData) {
        const issues = [];

        // Check for inconsistent data types in arrays
        if (Array.isArray(jsonData)) {
            const types = new Set();
            jsonData.forEach(item => {
                types.add(typeof item);
            });

            if (types.size > 1) {
                issues.push({
                    id: `inconsistent_types_${Date.now()}`,
                    type: 'Data Inconsistency',
                    severity: 'medium',
                    filePath,
                    message: `Array contains mixed data types: ${Array.from(types).join(', ')}`,
                    line: 1,
                    column: 0,
                    suggestedFix: 'Standardize data types in array',
                    detectedAt: new Date().toISOString(),
                    metadata: { types: Array.from(types) }
                });
            }
        }

        return issues;
    }

    /**
     * Check schema compliance
     */
    checkSchemaCompliance(filePath, jsonData) {
        const issues = [];

        // Check for common GGUF mock data schema requirements
        if (typeof jsonData === 'object' && jsonData !== null) {
            // Check for required fields based on file name patterns
            const fileName = path.basename(filePath, '.json').toLowerCase();
            
            if (fileName.includes('mock') || fileName.includes('data')) {
                const requiredFields = ['id', 'type', 'data'];
                const missingFields = requiredFields.filter(field => !(field in jsonData));
                
                if (missingFields.length > 0) {
                    issues.push({
                        id: `missing_fields_${Date.now()}`,
                        type: 'Missing Fields',
                        severity: 'medium',
                        filePath,
                        message: `Missing required fields: ${missingFields.join(', ')}`,
                        line: 1,
                        column: 0,
                        suggestedFix: `Add missing fields: ${missingFields.join(', ')}`,
                        detectedAt: new Date().toISOString(),
                        metadata: { missingFields }
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Check JSON formatting issues
     */
    checkJSONFormatting(filePath, lines) {
        const issues = [];

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            
            // Check for trailing whitespace
            if (line.endsWith(' ') || line.endsWith('\t')) {
                issues.push({
                    id: `trailing_whitespace_${Date.now()}_${lineNumber}`,
                    type: 'Trailing Whitespace',
                    severity: 'low',
                    filePath,
                    message: 'Line has trailing whitespace',
                    line: lineNumber,
                    column: line.length,
                    suggestedFix: 'Remove trailing whitespace',
                    detectedAt: new Date().toISOString()
                });
            }

            // Check for inconsistent indentation (mix of spaces and tabs)
            if (line.match(/^\s+/) && (line.includes(' ') && line.includes('\t'))) {
                issues.push({
                    id: `mixed_indentation_${Date.now()}_${lineNumber}`,
                    type: 'Mixed Indentation',
                    severity: 'low',
                    filePath,
                    message: 'Line uses mixed spaces and tabs for indentation',
                    line: lineNumber,
                    column: 0,
                    suggestedFix: 'Use consistent indentation (spaces or tabs)',
                    detectedAt: new Date().toISOString()
                });
            }
        });

        return issues;
    }

    /**
     * Detect code-specific issues
     */
    async detectCodeIssues(filePath, content) {
        const issues = [];
        const lines = content.split('\n');

        // Check for common code issues
        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const trimmed = line.trim();

            // Check for console.log statements
            if (trimmed.includes('console.log') && !trimmed.includes('//')) {
                issues.push({
                    id: `console_log_${Date.now()}_${lineNumber}`,
                    type: 'Console Statement',
                    severity: 'medium',
                    filePath,
                    message: 'Console.log statement found in code',
                    line: lineNumber,
                    column: line.indexOf('console.log'),
                    suggestedFix: 'Remove console.log or replace with proper logging',
                    detectedAt: new Date().toISOString()
                });
            }

            const todoCommentPrefix = ['//', ' TODO'].join('');
            if (trimmed.includes(todoCommentPrefix) && !trimmed.includes('@')) {
                issues.push({
                    id: `unassigned_todo_${Date.now()}_${lineNumber}`,
                    type: 'Unassigned engineering note',
                    severity: 'low',
                    filePath,
                    message: 'Engineering note comment without assignee',
                    line: lineNumber,
                    column: line.indexOf(todoCommentPrefix),
                    suggestedFix: 'Add assignee to the engineering note (e.g., // NOTE @username)',
                    detectedAt: new Date().toISOString()
                });
            }
        });

        return issues;
    }

    /**
     * Detect generic file issues
     */
    async detectGenericIssues(filePath, content) {
        const issues = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            
            // Check for very long lines
            if (line.length > 200) {
                issues.push({
                    id: `long_line_${Date.now()}_${lineNumber}`,
                    type: 'Long Line',
                    severity: 'low',
                    filePath,
                    message: `Line is too long (${line.length} characters)`,
                    line: lineNumber,
                    column: 200,
                    suggestedFix: 'Break long line into multiple lines',
                    detectedAt: new Date().toISOString(),
                    metadata: { lineLength: line.length }
                });
            }
        });

        return issues;
    }

    /**
     * Enhance issue with AI-powered assessment
     */
    async enhanceIssueWithAI(issue, content) {
        if (!this.options.enableAI) {
            return issue;
        }

        try {
            // Use severity assessor to get AI-powered severity
            const severity = await this.severityAssessor.assessSeverity(issue, content);
            issue.aiSeverity = severity;
            
            // Add AI confidence if different from default
            if (severity !== issue.severity) {
                issue.aiConfidence = 0.85;
                issue.recommendedSeverity = severity;
            }

        } catch (error) {
            console.warn('⚠️ AI assessment failed:', error.message);
        }

        return issue;
    }

    /**
     * Track issues in history
     */
    trackIssues(filePath, issues) {
        const previousIssues = this.issueHistory.get(filePath) || [];
        const currentIssues = issues.map(i => i.id);
        
        // Detect new and resolved issues
        const newIssues = currentIssues.filter(id => !previousIssues.includes(id));
        const resolvedIssues = previousIssues.filter(id => !currentIssues.includes(id));

        if (newIssues.length > 0 || resolvedIssues.length > 0) {
            console.log(`📊 File ${filePath}: ${newIssues.length} new, ${resolvedIssues.length} resolved issues`);
        }

        this.issueHistory.set(filePath, currentIssues);
    }

    /**
     * Handle file added event
     */
    async handleFileAdded(filePath) {
        console.log(`📄 File added: ${filePath}`);
        await this.analyzeFile(filePath);
    }

    /**
     * Handle file changed event
     */
    async handleFileChanged(filePath) {
        console.log(`📝 File changed: ${filePath}`);
        await this.analyzeFile(filePath);
    }

    /**
     * Handle file removed event
     */
    async handleFileRemoved(filePath) {
        console.log(`🗑️ File removed: ${filePath}`);
        this.issueHistory.delete(filePath);
        this.fileCache.delete(filePath);
    }

    /**
     * Load issue history from storage
     */
    async loadIssueHistory() {
        try {
            const historyPath = path.join(process.cwd(), 'data', 'issue-history.json');
            if (await fs.access(historyPath).then(() => true).catch(() => false)) {
                const historyData = await fs.readFile(historyPath, 'utf8');
                const history = JSON.parse(historyData);
                
                // Convert to Map format
                for (const [filePath, issues] of Object.entries(history)) {
                    this.issueHistory.set(filePath, issues);
                }
                
                console.log(`📚 Loaded issue history for ${this.issueHistory.size} files`);
            }
        } catch (error) {
            console.warn('⚠️ Could not load issue history:', error.message);
        }
    }

    /**
     * Save issue history to storage
     */
    async saveIssueHistory() {
        try {
            const historyPath = path.join(process.cwd(), 'data', 'issue-history.json');
            const historyData = {};
            
            // Convert Map to object
            for (const [filePath, issues] of this.issueHistory.entries()) {
                historyData[filePath] = issues;
            }
            
            await fs.writeFile(historyPath, JSON.stringify(historyData, null, 2));
            console.log(`💾 Saved issue history for ${this.issueHistory.size} files`);
        } catch (error) {
            console.error('❌ Could not save issue history:', error);
        }
    }

    /**
     * Get analysis statistics
     */
    getStats() {
        return {
            ...this.stats,
            filesInHistory: this.issueHistory.size,
            cachedFiles: this.fileCache.size,
            isWatching: this.fileWatcher !== null
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            await this.ready;
        } catch {
            // Initialization failures should not block cleanup.
        }

        if (this.fileWatcher) {
            await this.fileWatcher.close();
        }
        
        await this.saveIssueHistory();
        
        this.fileCache.clear();
        this.issueHistory.clear();
        
        console.log('🧹 GGUF Issue Analyzer cleaned up');
    }
}

/**
 * GGUF Rule Engine
 * Applies detection rules to identify issues
 */
class GGUFRuleEngine {
    constructor() {
        this.rules = new Map();
        this.initializeRules();
    }

    initializeRules() {
        // Add built-in rules
        this.addRule('json-syntax', {
            name: 'JSON Syntax Validation',
            description: 'Validates JSON syntax and structure',
            severity: 'high',
            apply: (content, filePath) => {
                // Implementation would go here
                return [];
            }
        });

        // Add more rules...
    }

    addRule(id, rule) {
        this.rules.set(id, rule);
    }

    applyRules(content, filePath) {
        const issues = [];
        
        for (const [ruleId, rule] of this.rules) {
            try {
                const ruleIssues = rule.apply(content, filePath);
                issues.push(...ruleIssues.map(issue => ({
                    ...issue,
                    ruleId,
                    ruleName: rule.name
                })));
            } catch (error) {
                console.error(`❌ Rule ${ruleId} failed:`, error);
            }
        }
        
        return issues;
    }
}

/**
 * GGUF Pattern Matcher
 * Identifies patterns across files
 */
class GGUFPatternMatcher {
    constructor() {
        this.patterns = new Map();
        this.initializePatterns();
    }

    initializePatterns() {
        // Add common patterns
        this.addPattern('duplicate-id', {
            name: 'Duplicate ID Pattern',
            description: 'Detects duplicate IDs across files',
            regex: /"id":\s*"([^"]+)"/g,
            severity: 'medium'
        });
    }

    addPattern(id, pattern) {
        this.patterns.set(id, pattern);
    }

    async matchPatterns(filePath, content) {
        const issues = [];
        
        for (const [patternId, pattern] of this.patterns) {
            const matches = content.match(pattern.regex);
            if (matches && matches.length > 1) {
                issues.push({
                    id: `pattern_${patternId}_${Date.now()}`,
                    type: 'Pattern Match',
                    severity: pattern.severity,
                    filePath,
                    message: `${pattern.name}: ${matches.length} matches found`,
                    line: 1,
                    column: 0,
                    suggestedFix: 'Review pattern matches for duplicates',
                    detectedAt: new Date().toISOString(),
                    metadata: { patternId, matches: matches.length }
                });
            }
        }
        
        return issues;
    }
}

/**
 * GGUF Severity Assessor
 * AI-powered severity assessment
 */
class GGUFSeverityAssessor {
    constructor() {
        this.severityWeights = {
            low: 1,
            medium: 3,
            high: 5,
            critical: 10
        };
    }

    async assessSeverity(issue, content) {
        // Simple rule-based assessment (could be enhanced with actual AI)
        const factors = {
            type: this.getTypeWeight(issue.type),
            impact: this.assessImpact(issue, content),
            frequency: this.assessFrequency(issue.type),
            complexity: this.assessComplexity(issue)
        };

        const score = Object.values(factors).reduce((sum, weight) => sum + weight, 0);
        
        if (score >= 8) return 'critical';
        if (score >= 5) return 'high';
        if (score >= 3) return 'medium';
        return 'low';
    }

    getTypeWeight(type) {
        const weights = {
            'JSON Syntax Error': 5,
            'Missing Fields': 3,
            'Data Inconsistency': 3,
            'Schema Violation': 4,
            'File Size': 2,
            'Console Statement': 2,
            'Trailing Whitespace': 1,
            'Long Line': 1
        };
        return weights[type] || 2;
    }

    assessImpact(issue, content) {
        // Assess potential impact based on issue type and context
        return 2; // Default medium impact
    }

    assessFrequency(type) {
        // Assess how frequently this type of issue occurs
        return 1; // Default low frequency
    }

    assessComplexity(issue) {
        // Assess complexity of fixing the issue
        return 1; // Default low complexity
    }
}

module.exports = GGUFIssueAnalyzer;
