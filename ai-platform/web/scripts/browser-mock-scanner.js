/**
 * Browser-Compatible Mock Data Scanner
 * Frontend version of the mock data scanner for web usage
 */

class BrowserMockScanner {
    constructor() {
        this.patterns = this.initializePatterns();
        this.compiledPatterns = this.compilePatterns(this.patterns);
        this.config = {
            confidenceThreshold: 0.7,
            enableContextAnalysis: true
        };
    }

    /**
     * Initialize patterns for browser scanning
     */
    initializePatterns() {
        return [
            // Test data patterns
            {
                pattern: 'mock.*data',
                confidence: 0.9,
                category: 'test_data',
                description: 'Mock data variable declarations'
            },
            {
                pattern: 'fake.*data',
                confidence: 0.8,
                category: 'test_data',
                description: 'Fake data variable declarations'
            },
            {
                pattern: 'test.*data',
                confidence: 0.7,
                category: 'test_data',
                description: 'Test data variable declarations'
            },
            
            // Mock function patterns
            {
                pattern: 'jest\\.fn\\(\\)',
                confidence: 0.95,
                category: 'mock_functions',
                description: 'Jest mock function'
            },
            {
                pattern: 'sinon\\.stub\\(\\)',
                confidence: 0.95,
                category: 'mock_functions',
                description: 'Sinon stub function'
            },
            {
                pattern: 'mock\\(',
                confidence: 0.8,
                category: 'mock_functions',
                description: 'Generic mock function call'
            },
            {
                pattern: 'spy\\(',
                confidence: 0.8,
                category: 'mock_functions',
                description: 'Spy function call'
            },
            
            // Hardcoded test values
            {
                pattern: '"test.*"',
                confidence: 0.6,
                category: 'hardcoded_values',
                description: 'Test string values'
            },
            {
                pattern: '\'test.*\'',
                confidence: 0.6,
                category: 'hardcoded_values',
                description: 'Test string values (single quotes)'
            },
            {
                pattern: '\\b(123|456|789|test|demo|example|sample)\\b',
                confidence: 0.5,
                category: 'hardcoded_values',
                description: 'Common test values'
            },
            
            // Email patterns
            {
                pattern: '\\b[a-zA-Z0-9._%+-]+@(test|example|demo|sample)\\.[a-zA-Z]{2,}\\b',
                confidence: 0.9,
                category: 'test_emails',
                description: 'Test email addresses'
            },
            {
                pattern: '\\btest@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b',
                confidence: 0.8,
                category: 'test_emails',
                description: 'Email addresses starting with test'
            },
            
            // Phone patterns
            {
                pattern: '\\+1-555-\\d{3}-\\d{4}',
                confidence: 0.9,
                category: 'test_phones',
                description: 'Test phone numbers (555 pattern)'
            },
            {
                pattern: '\\b555-\\d{3}-\\d{4}\\b',
                confidence: 0.9,
                category: 'test_phones',
                description: 'Test phone numbers (555 pattern)'
            },
            
            // Database patterns
            {
                pattern: ':memory:',
                confidence: 0.95,
                category: 'test_databases',
                description: 'SQLite in-memory database'
            },
            {
                pattern: 'sqlite:///:memory:',
                confidence: 0.95,
                category: 'test_databases',
                description: 'SQLite memory connection string'
            },
            {
                pattern: 'mongodb://localhost:27017/test',
                confidence: 0.9,
                category: 'test_databases',
                description: 'MongoDB test database'
            },
            
            // API patterns
            {
                pattern: 'axios\\.get\\(.*mock.*\\)|axios\\.post\\(.*mock.*\\)',
                confidence: 0.85,
                category: 'test_apis',
                description: 'Axios mock API calls'
            },
            {
                pattern: 'fetch\\(.*mock.*\\)|fetch\\(.*test.*\\)',
                confidence: 0.8,
                category: 'test_apis',
                description: 'Fetch mock API calls'
            },
            
            // Generic placeholders
            {
                pattern: '\\b(lorem ipsum|dolor sit|consectetur|adipiscing)\\b',
                confidence: 0.9,
                category: 'generic_placeholders',
                description: 'Lorem ipsum placeholder text'
            },
            {
                pattern: '\\b(xxx|yyy|zzz)\\b',
                confidence: 0.8,
                category: 'generic_placeholders',
                description: 'Common placeholder strings'
            },
            {
                pattern: '\\b(placeholder|dummy|mock_data|fake_data)\\b',
                confidence: 0.7,
                category: 'generic_placeholders',
                description: 'Explicit placeholder indicators'
            }
        ];
    }

    /**
     * Compile patterns for efficient matching
     */
    compilePatterns(patterns) {
        return patterns.map((pattern, index) => {
            try {
                if (typeof pattern === 'string') {
                    return {
                        regex: new RegExp(pattern, 'gi'),
                        type: 'regex',
                        confidence: 0.8
                    };
                } else if (pattern instanceof RegExp) {
                    return {
                        regex: pattern,
                        type: 'regex',
                        confidence: 0.8
                    };
                } else if (typeof pattern === 'object') {
                    if (!pattern.pattern) {
                        console.warn(`Pattern ${index} missing 'pattern' property:`, pattern);
                        return null;
                    }
                    return {
                        regex: new RegExp(pattern.pattern, pattern.flags || 'gi'),
                        type: pattern.type || 'regex',
                        confidence: pattern.confidence || 0.8,
                        category: pattern.category || 'general'
                    };
                } else {
                    console.warn(`Invalid pattern type ${index}:`, typeof pattern, pattern);
                    return null;
                }
            } catch (error) {
                console.error(`Error compiling pattern ${index}:`, pattern);
                console.error('Error details:', error.message);
                return null;
            }
        }).filter(Boolean);
    }

    /**
     * Scan content for patterns
     * @param {string} content - Content to scan
     * @returns {Array} Array of matches
     */
    scanContent(content) {
        const matches = [];

        for (const compiledPattern of this.compiledPatterns) {
            let match;
            const regex = new RegExp(compiledPattern.regex.source, compiledPattern.regex.flags);
            
            while ((match = regex./* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec(content)) !== null) {
                matches.push({
                    pattern: compiledPattern.regex.source,
                    match: match[0],
                    index: match.index,
                    groups: match.slice(1),
                    confidence: compiledPattern.confidence,
                    type: compiledPattern.type,
                    category: compiledPattern.category
                });
            }
        }

        return matches;
    }

    /**
     * Scan multiple files
     * @param {Array} files - Array of file objects
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Object>} Scan results
     */
    async scanFiles(files, progressCallback) {
        const results = {
            summary: {
                totalFiles: files.length,
                totalMatches: 0,
                filesWithFindings: 0,
                scanDate: new Date().toISOString(),
                healthScore: 0,
                healthGrade: 'F',
                healthStatus: 'Critical'
            },
            categories: {},
            severity: { high: 0, medium: 0, low: 0 },
            topFiles: []
        };

        const categoryCounts = {};
        const fileResults = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (progressCallback) {
                progressCallback(i + 1, files.length, file.name);
            }

            try {
                const content = await this.readFileContent(file);
                const matches = this.scanContent(content);
                
                // Filter by confidence threshold
                const filteredMatches = matches.filter(match => 
                    match.confidence >= this.config.confidenceThreshold
                );

                if (filteredMatches.length > 0) {
                    fileResults.push({
                        file: file.name,
                        matches: filteredMatches,
                        scanned: true
                    });

                    // Count categories
                    filteredMatches.forEach(match => {
                        if (!categoryCounts[match.category]) {
                            categoryCounts[match.category] = 0;
                        }
                        categoryCounts[match.category]++;
                    });

                    // Count severity
                    filteredMatches.forEach(match => {
                        const severity = this.calculateSeverity(match);
                        results.severity[severity]++;
                    });
                }
            } catch (error) {
                console.error(`Error scanning file ${file.name}:`, error);
                fileResults.push({
                    file: file.name,
                    error: error.message,
                    scanned: false
                });
            }
        }

        // Process results
        results.summary.totalMatches = fileResults.reduce((sum, result) => 
            sum + (result.matches ? result.matches.length : 0), 0);
        results.summary.filesWithFindings = fileResults.filter(result => 
            result.matches && result.matches.length > 0).length;

        // Convert category counts to categories array
        results.categories = Object.entries(categoryCounts).map(([category, count]) => ({
            category,
            count,
            description: this.getCategoryDescription(category)
        }));

        // Calculate top files
        results.topFiles = fileResults
            .filter(result => result.matches && result.matches.length > 0)
            .map(result => ({
                file: result.file,
                matchCount: result.matches.length,
                highSeverityCount: result.matches.filter(m => 
                    this.calculateSeverity(m) === 'high').length
            }))
            .sort((a, b) => b.matchCount - a.matchCount);

        // Calculate health score
        const healthScore = this.calculateHealthScore(results);
        results.summary.healthScore = healthScore.score;
        results.summary.healthGrade = healthScore.grade;
        results.summary.healthStatus = healthScore.status;

        return results;
    }

    /**
     * Read file content (browser-compatible)
     * @param {Object} file - File object
     * @returns {Promise<string>} File content
     */
    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            
            reader.onerror = () => {
                reject(new Error(`Failed to read file ${file.name}`));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Calculate severity level for a match
     * @param {Object} match - Match object
     * @returns {string} Severity level
     */
    calculateSeverity(match) {
        const categorySeverityMap = {
            'test_databases': 'high',
            'test_apis': 'high',
            'hardcoded_values': 'medium',
            'test_data': 'medium',
            'test_emails': 'low',
            'test_phones': 'low',
            'mock_functions': 'low',
            'generic_placeholders': 'medium'
        };

        let severity = categorySeverityMap[match.category] || 'medium';
        
        // Adjust based on confidence
        if (match.confidence < 0.5) {
            if (severity === 'high') {
                severity = 'medium';
            } else if (severity === 'medium') {
                severity = 'low';
            }
        } else if (match.confidence > 0.8) {
            if (severity === 'low' && match.category !== 'mock_functions') {
                severity = 'medium';
            }
        }

        return severity;
    }

    /**
     * Calculate health score
     * @param {Object} results - Scan results
     * @returns {Object} Health score object
     */
    calculateHealthScore(results) {
        const totalFindings = results.summary.totalMatches;
        const highSeverity = results.severity.high;
        const mediumSeverity = results.severity.medium;
        const lowSeverity = results.severity.low;

        // Weighted score calculation
        const weightedScore = (highSeverity * 10) + (mediumSeverity * 5) + (lowSeverity * 1);
        
        // Penalty for high volume
        const volumePenalty = totalFindings > 100 ? Math.min(totalFindings / 100, 50) : 0;
        
        const score = Math.max(0, 100 - weightedScore - volumePenalty);
        
        let grade, status;
        if (score >= 80) {
            grade = 'A';
            status = 'Excellent';
        } else if (score >= 60) {
            grade = 'B';
            status = 'Good';
        } else if (score >= 40) {
            grade = 'C';
            status = 'Poor';
        } else {
            grade = 'F';
            status = 'Critical';
        }

        return {
            score: Math.round(score),
            grade,
            status,
            details: {
                totalFindings,
                weightedScore,
                penalty: volumePenalty,
                confidence: 'medium'
            }
        };
    }

    /**
     * Get category description
     * @param {string} category - Category name
     * @returns {string} Description
     */
    getCategoryDescription(category) {
        const descriptions = {
            'test_data': 'Test data patterns',
            'mock_functions': 'Mock function patterns',
            'test_emails': 'Test email patterns',
            'test_phones': 'Test phone patterns',
            'test_databases': 'Test database patterns',
            'test_apis': 'Test API patterns',
            'hardcoded_values': 'Hardcoded test values',
            'generic_placeholders': 'Generic placeholder patterns'
        };
        
        return descriptions[category] || 'Unknown category';
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
     * @param {Object} results - Scan results
     * @returns {Array} Array of recommendations
     */
    generateRecommendations(results) {
        const recommendations = [];
        
        if (!results || !results.severity) {
            return recommendations;
        }

        if (results.severity.high > 0) {
            recommendations.push({
                priority: 'high',
                title: 'Address High Severity Issues',
                description: `Found ${results.severity.high} high severity mock data issues that should be addressed immediately`,
                action: 'Review and replace hardcoded sensitive data'
            });
        }

        // Check for categories with many matches
        if (results.categories) {
            for (const category of results.categories) {
                if (category.count > 10) {
                    recommendations.push({
                        priority: 'medium',
                        title: `Optimize ${category.category} Usage`,
                        description: `Found ${category.count} instances of ${category.category}, consider consolidating or parameterizing`,
                        action: 'Create shared test fixtures or data generators'
                    });
                }
            }
        }

        return recommendations;
    }

    /**
     * Get files with most matches
     * @param {Object} results - Scan results
     * @param {number} limit - Maximum number of files to return
     * @returns {Array} Array of files with match counts
     */
    getTopFiles(results, limit = 10) {
        if (!results || !results.topFiles) {
            return [];
        }
        
        return results.topFiles
            .slice(0, limit)
            .map(file => ({
                file: file.file,
                matchCount: file.matchCount,
                highSeverityCount: file.highSeverityCount || 0
            }));
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.MockDataScanner = BrowserMockScanner;
}

// Also support module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrowserMockScanner;
}
