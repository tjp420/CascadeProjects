/**
 * @deprecated Use server/lib/mock-data-scanner.js for dashboard mock/sample filesystem scans.
 * This module scans source code for mock-data *patterns* in remediation CLI scripts only.
 * See: src/web/scripts/authoritative-scan.js, run-full-scan.js
 */

import { ContextFilter } from './context-filter.js';
import { getAllFrameworkPatterns, detectFramework } from './framework-patterns.js';
import { HealthScoreCalculator } from './health-score-calculator.js';
import { LanguageDetector, getAllLanguagePatterns } from './language-analyzer.js';
import { getAllPatterns, getPatternCategories, MOCK_PATTERNS } from './mock-patterns.js';
import { BaseScanner, PatternMatcher } from './scanner-core.js';

/**
 * Mock Data Scanner
 * Extends BaseScanner to specifically detect mock data patterns
 */
class MockDataScanner extends BaseScanner {
    /**
     * Create a new mock data scanner
     * @param {Object} config - Scanner configuration
     */
    constructor(config = {}) {
        // Lower confidence threshold to catch more findings
        const defaultConfig = {
            confidenceThreshold: 0.5,
            enableContextAnalysis: true,
            ...config
        };
        super(defaultConfig);
        
        // Initialize patterns with better error handling
        let allPatterns = [];
        
        try {
            // Get base patterns - these should be properly formatted
            const basePatterns = getAllPatterns();
            console.log('📝 Loading base patterns:', basePatterns?.length || 0);
            
            if (Array.isArray(basePatterns)) {
                allPatterns = allPatterns.concat(basePatterns);
                console.log('✅ Base patterns loaded successfully');
            } else {
                console.warn('⚠️ Base patterns is not an array:', typeof basePatterns);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load base patterns:', error.message);
        }
        
        // Try to load framework patterns (optional)
        try {
            if (typeof getAllFrameworkPatterns === 'function') {
                const frameworkPatterns = getAllFrameworkPatterns();
                console.log('📝 Loading framework patterns:', typeof frameworkPatterns);
                
                if (frameworkPatterns && typeof frameworkPatterns === 'object') {
                    const frameworkArray = this.convertPatternsToArray(frameworkPatterns);
                    allPatterns = allPatterns.concat(frameworkArray);
                    console.log('✅ Framework patterns loaded:', frameworkArray.length);
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to load framework patterns:', error.message);
        }
        
        // Try to load language patterns (optional)
        try {
            if (typeof getAllLanguagePatterns === 'function') {
                const languagePatterns = getAllLanguagePatterns();
                console.log('📝 Loading language patterns:', typeof languagePatterns);
                
                if (languagePatterns && typeof languagePatterns === 'object') {
                    const languageArray = this.convertPatternsToArray(languagePatterns);
                    allPatterns = allPatterns.concat(languageArray);
                    console.log('✅ Language patterns loaded:', languageArray.length);
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to load language patterns:', error.message);
        }
        
        console.log('🎯 Total patterns to compile:', allPatterns.length);
        
        // Validate patterns before initialization
        const validPatterns = allPatterns.filter(pattern => {
            if (!pattern || typeof pattern !== 'object') {
                console.warn('⚠️ Invalid pattern format:', pattern);
                return false;
            }
            if (!pattern.pattern) {
                console.warn('⚠️ Pattern missing pattern property:', pattern);
                return false;
            }
            return true;
        });
        
        console.log('📊 Valid patterns:', validPatterns.length, 'of', allPatterns.length);
        
        if (validPatterns.length === 0) {
            console.error('❌ No valid patterns to initialize scanner');
            throw new Error('No valid patterns available for scanning');
        }
        
        try {
            this.patternMatcher = new PatternMatcher(validPatterns);
            console.log('🔍 Pattern matcher initialized with', this.patternMatcher.patterns.length, 'patterns');
            console.log('✅ All patterns compiled successfully');
            
            // Log compiled pattern count
            console.log('📊 Compiled patterns count:', this.patternMatcher.compiledPatterns?.length || 0);
        } catch (error) {
            console.error('❌ Failed to initialize pattern matcher:', error);
            console.error('❌ Error details:', error.message);
            
            // Log first few patterns to debug
            console.log('🔍 First 3 patterns for debugging:');
            validPatterns.slice(0, 3).forEach((pattern, index) => {
                console.log(`  ${index}:`, {
                    pattern: pattern.pattern,
                    category: pattern.category,
                    confidence: pattern.confidence
                });
            });
            
            throw error;
        }
        
        // Initialize remaining components
        this.categories = getPatternCategories();
        this.healthScoreCalculator = new HealthScoreCalculator();
        this.contextFilter = new ContextFilter();
        this.scanStats = {
            filesScanned: 0,
            totalMatches: 0,
            matchesByCategory: {},
            filesWithMatches: 0
        };
    }

    /**
     * Convert pattern object to array format
     * @param {Object} patternObject - Object with pattern categories
     * @returns {Array} Array of patterns
     */
    convertPatternsToArray(patternObject) {
        const patterns = [];
        
        for (const [category, categoryData] of Object.entries(patternObject)) {
            if (categoryData && categoryData.patterns && Array.isArray(categoryData.patterns)) {
                categoryData.patterns.forEach(pattern => {
                    patterns.push({
                        ...pattern,
                        category: pattern.category || category
                    });
                });
            }
        }
        
        return patterns;
    }

    /**
     * Scan content for mock data patterns
     * @param {string} content - File content
     * @param {string} filePath - File path
     * @returns {Array} Array of mock data matches
     */
    scanContent(content, filePath) {
        console.log(`🔍 Scanning content for ${filePath}`);
        console.log(`📊 Content length: ${content.length} characters`);
        console.log(`🎯 Confidence threshold: ${this.config.confidenceThreshold}`);
        console.log(`🔍 Available patterns: ${this.patternMatcher.compiledPatterns?.length || 0}`);
        
        // Log content preview for debugging
        const contentPreview = content.substring(0, 200).replace(/\n/g, '\\n');
        console.log(`📝 Content preview: "${contentPreview}..."`);
        
        // Check if pattern matcher is properly initialized
        if (!this.patternMatcher || !this.patternMatcher.compiledPatterns) {
            console.error('❌ Pattern matcher not properly initialized');
            return [];
        }
        
        // Use chunked processing for large files
        const matches = content.length > 50000 ? 
            this.scanContentChunked(content, filePath) : 
            this.patternMatcher.match(content);
            
        console.log(`🎯 Pattern matcher found ${matches.length} raw matches in ${filePath}`);
        
        // Log details about matches for debugging
        if (matches.length > 0) {
            console.log('📋 Match details (first 3):');
            matches.slice(0, 3).forEach((match, index) => {
                console.log(`  ${index + 1}: "${match.match}" (confidence: ${match.confidence}, category: ${match.category})`);
            });
        } else {
            // Debug why no matches were found
            console.log('🔍 Debugging - checking for common patterns in content:');
            const debugPatterns = [
                { name: 'test strings', pattern: /\btest\b/gi, matches: content.match(/\btest\b/gi) },
                { name: 'mock strings', pattern: /\bmock\b/gi, matches: content.match(/\bmock\b/gi) },
                { name: 'demo strings', pattern: /\bdemo\b/gi, matches: content.match(/\bdemo\b/gi) },
                { name: 'example strings', pattern: /\bexample\b/gi, matches: content.match(/\bexample\b/gi) },
                { name: 'alert calls', pattern: /alert\(/gi, matches: content.match(/alert\(/gi) },
                { name: 'console.log', pattern: /console\.log/gi, matches: content.match(/console\.log/gi) }
            ];
            
            debugPatterns.forEach(debug => {
                if (debug.matches && debug.matches.length > 0) {
                    console.log(`  ✅ Found ${debug.matches.length} ${debug.name}: ${debug.matches.slice(0, 3).join(', ')}`);
                } else {
                    console.log(`  ❌ No ${debug.name} found`);
                }
            });
        }
        
        // Filter matches by confidence threshold
        const filteredMatches = matches.filter(match => 
            match.confidence >= this.config.confidenceThreshold
        );
        console.log(`✅ After filtering (threshold ${this.config.confidenceThreshold}), ${filteredMatches.length} matches remain in ${filePath}`);
        
        if (filteredMatches.length !== matches.length) {
            console.log(`📊 Filtered out ${matches.length - filteredMatches.length} matches below threshold`);
        }

        // Add context analysis if enabled
        if (this.config.enableContextAnalysis) {
            return this.addContextAnalysis(filteredMatches, content, filePath);
        }

        return filteredMatches;
    }

    /**
     * Scan content in chunks for large files
     * @param {string} content - File content
     * @param {string} filePath - File path
     * @returns {Array} Array of matches
     */
    scanContentChunked(content, filePath) {
        console.log(`🔄 Using chunked processing for large file: ${filePath} (${content.length} chars)`);
        
        const chunkSize = 10000; // 10KB chunks
        const overlap = 500; // 500 character overlap to catch patterns spanning chunks
        const allMatches = [];
        
        for (let i = 0; i < content.length; i += chunkSize - overlap) {
            const start = i;
            const end = Math.min(i + chunkSize, content.length);
            const chunk = content.substring(start, end);
            
            // Match patterns in this chunk
            const chunkMatches = this.patternMatcher.match(chunk);
            
            // Adjust match indices to account for chunk position
            const adjustedMatches = chunkMatches.map(match => ({
                ...match,
                index: match.index + start
            }));
            
            allMatches.push(...adjustedMatches);
            
            // Progress logging for very large files
            if (content.length > 100000 && i % (chunkSize * 5) === 0) {
                const progress = Math.round((i / content.length) * 100);
                console.log(`📊 Chunked processing progress: ${progress}% (${i}/${content.length})`);
            }
        }
        
        // Remove duplicate matches (patterns spanning chunk boundaries)
        const uniqueMatches = this.deduplicateMatches(allMatches);
        console.log(`🔄 Chunked processing complete: ${uniqueMatches.length} unique matches found`);
        
        return uniqueMatches;
    }

    /**
     * Remove duplicate matches from chunked processing
     * @param {Array} matches - Array of matches
     * @returns {Array} Deduplicated matches
     */
    deduplicateMatches(matches) {
        const seen = new Set();
        const unique = [];
        
        for (const match of matches) {
            const key = `${match.index}-${match.match}-${match.category}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(match);
            }
        }
        
        return unique;
    }

    /**
     * Add context analysis to matches with enhanced filtering
     * @param {Array} matches - Array of matches
     * @param {string} content - File content
     * @param {string} filePath - File path
     * @returns {Array} Enhanced matches with context
     */
    addContextAnalysis(matches, content, filePath) {
        let enhancedMatches = matches.map(match => {
            const context = this.getContext(match.index, content, 100, match.length);
            return {
                ...match,
                file: filePath,
                context: context,
                severity: this.calculateSeverity(match),
                line: this.getLineNumber(match.index, content)
            };
        });

        // Apply enhanced context filtering with content analysis
        enhancedMatches = this.contextFilter.filterFindings(enhancedMatches, filePath, content);
        return enhancedMatches;
    }

    /**
     * Get context around a match
     * @param {number} index - Match index
     * @param {string} content - File content
     * @param {number} contextSize - Context window size
     * @param {number} matchLength - Length of the match
     * @returns {string} Context string
     */
    getContext(index, content, contextSize = 100, matchLength = 0) {
        const start = Math.max(0, index - contextSize);
        const end = Math.min(content.length, index + contextSize + matchLength);
        return content.substring(start, end);
    }

    /**
     * Get line number for a match
     * @param {number} index - Match index
     * @param {string} content - File content
     * @returns {number} Line number
     */
    getLineNumber(index, content) {
        const beforeMatch = content.substring(0, index);
        return beforeMatch.split('\n').length;
    }

    /**
     * Calculate severity level for a match
     * @param {Object} match - Match object
     * @returns {string} Severity level
     */
    calculateSeverity(match) {
        const categorySeverityMap = {
            // High severity - critical mock data that impacts production
            'test_databases': 'high',
            'test_apis': 'high',
            'coming_soon_features': 'high', // Coming soon features are critical missing functionality
            'alert_placeholders': 'high', // Alert placeholders indicate non-functional features
            'mock_report_functions': 'high', // Mock report functions mean no real reporting
            
            // Medium severity - significant mock data usage
            'hardcoded_values': 'medium',
            'test_data': 'medium',
            'generic_placeholders': 'medium',
            'test_urls': 'medium',
            'todo_mock_related': 'medium', // TODOs about mock data indicate incomplete implementation
            'fixme_mock_related': 'medium', // FIXMEs about mock data are higher priority
            'todo_coming_soon': 'medium', // TODOs about coming soon features
            
            // Low severity - development artifacts and test data
            'test_emails': 'low',
            'test_phones': 'low',
            'test_dates': 'low',
            'test_ids': 'low',
            'mock_functions': 'low',
            'development_patterns': 'low',
            'development_comments': 'low',
            'todo_infrastructure': 'low' // Infrastructure TODOs are often legitimate planning
        };

        // Get base severity from category
        let severity = categorySeverityMap[match.category] || 'medium';
        
        // Adjust severity based on confidence
        if (match.confidence < 0.5) {
            // Low confidence findings are less severe
            if (severity === 'high') {
                severity = 'medium';
            } else if (severity === 'medium') {
                severity = 'low';
            }
        } else if (match.confidence > 0.8) {
            // High confidence findings can be more severe
            if (severity === 'low' && match.category !== 'development_patterns') {
                severity = 'medium';
            }
        }

        return severity;
    }

    /**
     * Get recommendation for a match
     * @param {Object} match - Match object
     * @returns {string} Recommendation
     */
    getRecommendation(match) {
        const recommendations = {
            'test_databases': 'Consider using environment-specific database configurations',
            'test_apis': 'Use environment variables or configuration files for API credentials',
            'hardcoded_values': 'Move test values to configuration files or test fixtures',
            'test_emails': 'Use parameterized test data instead of hardcoded emails',
            'test_phones': 'Generate phone numbers programmatically in tests',
            'test_dates': 'Use date utilities to generate test dates',
            'test_ids': 'Use ID generation utilities in tests',
            'test_data': 'Organize test data in dedicated fixture files',
            'mock_functions': 'Ensure mocks are properly cleaned up after tests'
        };

        return recommendations[match.category] || 'Review and consider if this can be parameterized';
    }

    /**
     * Process scan results with enhanced statistics
     * @param {Array} results - Array of settled promises
     */
    processResults(results) {
        super.processResults(results);
        
        // Calculate enhanced statistics
        this.scanStats = {
            filesScanned: this.results.length,
            totalMatches: this.results.reduce((sum, result) => sum + result.matches.length, 0),
            matchesByCategory: {},
            filesWithMatches: this.results.filter(result => result.matches.length > 0).length
        };

        // Count matches by category
        for (const result of this.results) {
            for (const match of result.matches) {
                if (!this.scanStats.matchesByCategory[match.category]) {
                    this.scanStats.matchesByCategory[match.category] = 0;
                }
                this.scanStats.matchesByCategory[match.category]++;
            }
        }
    }

    /**
     * Get detailed scan statistics
     * @returns {Object} Detailed scan statistics
     */
    getDetailedStats() {
        const baseStats = super.getStats();
        return {
            totalFiles: this.scanStats.filesScanned || baseStats.totalFiles,
            totalMatches: this.scanStats.totalMatches || baseStats.totalMatches,
            filesWithFindings: this.scanStats.filesWithMatches || 0,
            matchesByCategory: this.scanStats.matchesByCategory || {},
            categories: this.categories,
            patternsUsed: this.patternMatcher.patterns.length,
            isScanning: baseStats.isScanning
        };
    }

    /**
     * Get matches by category
     * @param {string} category - Category name
     * @returns {Array} Array of matches for the category
     */
    getMatchesByCategory(category) {
        const categoryMatches = [];
        
        for (const result of this.results) {
            for (const match of result.matches) {
                if (match.category === category) {
                    categoryMatches.push(match);
                }
            }
        }
        
        return categoryMatches;
    }

    /**
     * Get high severity matches
     * @returns {Array} Array of high severity matches
     */
    getHighSeverityMatches() {
        const highSeverityMatches = [];
        
        for (const result of this.results) {
            for (const match of result.matches) {
                if (match.severity === 'high') {
                    highSeverityMatches.push(match);
                }
            }
        }
        
        return highSeverityMatches;
    }

    /**
     * Generate scan report
     * @returns {Object} Scan report
     */
    generateReport() {
        const stats = this.getDetailedStats();
        console.log('🔍 Detailed stats:', stats);
        const allMatches = this.getAllMatches();
        const healthScore = this.healthScoreCalculator.calculateHealthScore(allMatches);
        
        return {
            summary: {
                totalFiles: stats.filesScanned,
                totalMatches: stats.totalMatches,
                filesWithFindings: stats.filesWithMatches,
                scanDate: new Date().toISOString(),
                healthScore: healthScore.score,
                healthGrade: healthScore.grade,
                healthStatus: healthScore.status
            },
            categories: Object.entries(stats.matchesByCategory).map(([category, count]) => ({
                category,
                count,
                description: MOCK_PATTERNS[category]?.description || 'Unknown category'
            })),
            severity: {
                high: this.getMatchesBySeverity('high').length,
                medium: this.getMatchesBySeverity('medium').length,
                low: this.getMatchesBySeverity('low').length
            },
            healthScore: healthScore,
            recommendations: this.healthScoreCalculator.getRecommendations(healthScore),
            topFiles: this.getTopFiles()
        };
    }

    /**
     * Get all matches from all results
     * @returns {Array} Array of all matches
     */
    getAllMatches() {
        const allMatches = [];
        
        for (const result of this.results) {
            for (const match of result.matches) {
                allMatches.push(match);
            }
        }
        
        return allMatches;
    }

    /**
     * Get matches by severity level
     * @param {string} severity - Severity level
     * @returns {Array} Array of matches
     */
    getMatchesBySeverity(severity) {
        const severityMatches = [];
        
        for (const result of this.results) {
            for (const match of result.matches) {
                if (match.severity === severity) {
                    severityMatches.push(match);
                }
            }
        }
        
        return severityMatches;
    }

    /**
     * Scan multiple files with progress callback
     * @param {Array} files - Array of File objects
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<Object>} Scan results with summary
     */
    async scanFiles(files, progressCallback) {
        console.log('🚀 scanFiles called with', files.length, 'files');
        this.isScanning = true;
        this.results = [];
        
        try {
            console.log(`🔍 Starting scan of ${files.length} files`);
            
            const totalFiles = files.length;
            let processedFiles = 0;
            
            // Process files with progress tracking
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                if (progressCallback) {
                    progressCallback(i + 1, totalFiles, file.name);
                }
                
                try {
                    console.log(`📁 Processing file: ${file.name} (${file.size} bytes)`);
                    console.log(`📁 File type: ${file.type || 'unknown'}`);
                    console.log(`📁 File last modified: ${file.lastModified ? new Date(file.lastModified).toISOString() : 'unknown'}`);
                    
                    // Read file content
                    const content = await this.readFileContent(file);
                    console.log(`📖 File content length: ${content.length} characters`);
                    console.log(`📖 Content preview: ${content.substring(0, 100)}...`);
                    
                    // Scan for patterns
                    const matches = this.scanContent(content, file.name);
                    console.log(`🔍 Found ${matches.length} matches in ${file.name}`);
                    
                    if (matches.length > 0) {
                        console.log(`✅ Adding ${file.name} to results with ${matches.length} matches`);
                        this.results.push({
                            file: file.name,
                            matches: matches,
                            scanned: true
                        });
                    }
                    
                    processedFiles++;
                } catch (error) {
                    console.error(`❌ Error scanning file ${file.name}:`, error);
                    console.error('❌ Error type:', error.constructor.name);
                    console.error('❌ Error message:', error.message);
                    console.error('❌ Error stack:', error.stack);
                    console.error('❌ File details:', {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified
                    });
                    // Continue with next file
                }
            }
            
            // Update scan statistics
            this.scanStats = {
                filesScanned: processedFiles,
                totalMatches: this.results.reduce((sum, result) => sum + result.matches.length, 0),
                matchesByCategory: {},
                filesWithMatches: this.results.filter(result => result.matches.length > 0).length
            };

            // Count matches by category
            for (const result of this.results) {
                for (const match of result.matches) {
                    if (!this.scanStats.matchesByCategory[match.category]) {
                        this.scanStats.matchesByCategory[match.category] = 0;
                    }
                    this.scanStats.matchesByCategory[match.category]++;
                }
            }
            
            // Generate report with summary
            console.log('📊 About to generate report with', this.results.length, 'results');
            const report = this.generateReport();
            
            console.log(`✅ Scan completed. Processed ${processedFiles} files`);
            console.log('📊 Final scan stats:', this.scanStats);
            console.log('📋 Final report summary:', report.summary);
            console.log('📋 Complete report object:', report);
            
            return report;
            
        } catch (error) {
            console.error('❌ Scan failed:', error);
            throw error;
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Read file content from file object
     * @param {Object} file - File object (browser File or object with path)
     * @returns {Promise<string>} File content
     */
    async readFileContent(file) {
        try {
            console.log(`📖 Starting to read file: ${file.name}`);
            console.log(`📖 File size: ${file.size} bytes`);
            console.log(`📖 File type: ${file.type || 'unknown'}`);
            
            // Check if we're in browser environment with File objects
            if (typeof window !== 'undefined' && file instanceof File) {
                // Browser environment - use FileReader
                return await this.readFileContentBrowser(file);
            } else if (file.path && typeof require !== 'undefined') {
                // Node.js environment - use fs module
                return await this.readFileContentNode(file);
            } else {
                // Fallback - try to read as text
                return await this.readFileContentFallback(file);
            }
        } catch (error) {
            console.error(`❌ Error reading file ${file.name}:`, error);
            console.error('❌ Error type:', error.constructor.name);
            console.error('❌ Error message:', error.message);
            throw new Error(`Failed to read file ${file.name}: ${error.message}`);
        }
    }

    /**
     * Read file content in browser environment
     * @param {File} file - Browser File object
     * @returns {Promise<string>} File content
     */
    async readFileContentBrowser(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const content = event.target.result;
                console.log(`✅ Successfully read file (browser): ${file.name}`);
                console.log(`📖 Content length: ${content.length} characters`);
                resolve(content);
            };
            
            reader.onerror = (error) => {
                console.error(`❌ FileReader error for ${file.name}:`, error);
                reject(new Error(`FileReader failed: ${error}`));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Read file content in Node.js environment
     * @param {Object} file - File object with path property
     * @returns {Promise<string>} File content
     */
    async readFileContentNode(file) {
        try {
            const fs = await import('fs/promises');
            const content = await fs.readFile(file.path, 'utf8');
            
            console.log(`✅ Successfully read file (Node.js): ${file.name}`);
            console.log(`📖 Content length: ${content.length} characters`);
            
            return content;
        } catch (error) {
            console.error(`❌ Node.js fs error for ${file.name}:`, error);
            throw error;
        }
    }

    /**
     * Fallback file reading method
     * @param {Object} file - File object
     * @returns {Promise<string>} File content
     */
    async readFileContentFallback(file) {
        // Try different approaches to read the file
        if (file.text && typeof file.text === 'function') {
            // Modern File API
            const content = await file.text();
            console.log(`✅ Successfully read file (fallback): ${file.name}`);
            return content;
        } else if (file.content) {
            // File already has content
            console.log(`✅ Using existing content for: ${file.name}`);
            return file.content;
        } else {
            throw new Error(`Unable to read file ${file.name}: no compatible reading method found`);
        }
    }

    /**
     * Generate priority classification for scan results
     * @param {Object} results - Scan results
     * @returns {Object} Priority classification
     */
    generatePriorityClassification(results) {
        const priorities = {
            high: [],
            medium: [],
            low: []
        };

        if (!results || !results.summary) {
            return priorities;
        }

        // Classify based on health score
        if (results.summary.healthScore < 60) {
            priorities.high.push('Overall health score requires immediate attention');
        } else if (results.summary.healthScore < 80) {
            priorities.medium.push('Health score could be improved');
        }

        // Classify based on findings count
        if (results.summary.totalMatches > 50) {
            priorities.high.push('High number of mock data findings detected');
        } else if (results.summary.totalMatches > 20) {
            priorities.medium.push('Moderate number of mock data findings');
        }

        // Classify based on severity breakdown
        if (results.severity) {
            if (results.severity.high > 10) {
                priorities.high.push('Multiple high severity issues found');
            } else if (results.severity.high > 0) {
                priorities.medium.push('Some high severity issues detected');
            }

            if (results.severity.medium > 20) {
                priorities.medium.push('Many medium severity issues found');
            }
        }

        return priorities;
    }

    /**
     * Generate recommendations based on scan results
     * @returns {Array} Array of recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        const highSeverityMatches = this.getHighSeverityMatches();
        
        if (highSeverityMatches.length > 0) {
            recommendations.push({
                priority: 'high',
                title: 'Address High Severity Issues',
                description: `Found ${highSeverityMatches.length} high severity mock data issues that should be addressed immediately`,
                action: 'Review and replace hardcoded sensitive data'
            });
        }

        // Check for categories with many matches
        for (const [category, count] of Object.entries(this.scanStats.matchesByCategory)) {
            if (count > 10) {
                recommendations.push({
                    priority: 'medium',
                    title: `Optimize ${category} Usage`,
                    description: `Found ${count} instances of ${category}, consider consolidating or parameterizing`,
                    action: 'Create shared test fixtures or data generators'
                });
            }
        }

        return recommendations;
    }

    /**
     * Get files with most matches
     * @param {number} limit - Maximum number of files to return
     * @returns {Array} Array of files with match counts
     */
    getTopFiles(limit = 10) {
        const fileCounts = this.results.map(result => ({
            file: result.file,
            matchCount: result.matches.length,
            highSeverityCount: result.matches.filter(m => m.severity === 'high').length
        }));

        return fileCounts
            .sort((a, b) => b.matchCount - a.matchCount)
            .slice(0, limit);
    }

    /**
     * Export results to JSON
     * @returns {string} JSON string of results
     */
    exportToJSON() {
        return JSON.stringify({
            report: this.generateReport(),
            results: this.results,
            stats: this.getDetailedStats()
        }, null, 2);
    }

    /**
     * Export results to CSV
     * @returns {string} CSV string of results
     */
    exportToCSV() {
        const headers = ['File', 'Line', 'Match', 'Category', 'Severity', 'Confidence', 'Recommendation'];
        const rows = [headers.join(',')];

        for (const result of this.results) {
            for (const match of result.matches) {
                const row = [
                    `"${result.file}"`,
                    match.lineNumber || '',
                    `"${match.match}"`,
                    match.category,
                    match.severity,
                    match.confidence,
                    `"${match.recommendation}"`
                ];
                rows.push(row.join(','));
            }
        }

        return rows.join('\n');
    }
}

export { MockDataScanner };
