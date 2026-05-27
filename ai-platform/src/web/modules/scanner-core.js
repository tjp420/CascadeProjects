/**
 * Scanner Core Module
 * Core functionality for data scanning operations
 */

/**
 * Semaphore for controlling concurrent operations
 */
class Semaphore {
    /**
     * Create a new semaphore
     * @param {number} maxConcurrency - Maximum number of concurrent operations
     */
    constructor(maxConcurrency) {
        this.maxConcurrency = maxConcurrency;
        this.currentConcurrency = 0;
        this.queue = [];
    }

    /**
     * Acquire a permit from the semaphore
     * @returns {Promise<void>} Promise that resolves when permit is acquired
     */
    async acquire() {
        return new Promise((resolve) => {
            if (this.currentConcurrency < this.maxConcurrency) {
                this.currentConcurrency++;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    /**
     * Release a permit back to the semaphore
     */
    release() {
        this.currentConcurrency--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        }
    }
}

/**
 * Abstract base class for data scanners
 */
class BaseScanner {
    /**
     * Create a new scanner instance
     * @param {Object} config - Scanner configuration
     */
    constructor(config = {}) {
        this.config = {
            excludeDirectories: ['remediation-backups', 'node_modules', 'dist', 'build', '.git', 'vendor'],
            excludeExtensions: ['.pyc', '.exe', '.dll', '.so', '.bin', '.jpg', '.png', '.gif', '.pdf', '.zip', '.min.js', '.min.css'],
            maxFileSize: 10 * 1024 * 1024, // 10MB
            confidenceThreshold: 0.7,
            enableContextAnalysis: true,
            ...config
        };
        this.results = [];
        this.isScanning = false;
        this.semaphore = new Semaphore(10); // Max 10 concurrent operations
    }

    /**
     * Start the scanning process
     * @param {string} targetPath - Path to scan
     * @returns {Promise<Array>} Scan results
     */
    async scan(targetPath) {
        if (this.isScanning) {
            throw new Error('Scanner is already running');
        }

        this.isScanning = true;
        this.results = [];

        try {
            console.log(`🔍 Starting scan of: ${targetPath}`);
            
            // Get files to scan
            const files = await this.getFilesToScan(targetPath);
            console.log(`📁 Found ${files.length} files to scan`);
            
            // Scan files in parallel with semaphore control
            const scanPromises = files.map(file => this.scanFile(file));
            const results = await Promise.allSettled(scanPromises);
            
            // Process results
            this.processResults(results);
            
            console.log(`✅ Scan completed. Found ${this.results.length} matches`);
            return this.results;
            
        } catch (error) {
            console.error('❌ Scan failed:', error);
            throw error;
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Get list of files to scan
     * @param {string} targetPath - Target path
     * @returns {Promise<Array>} List of files
     */
    async getFilesToScan(targetPath) {
        // This would be implemented based on the specific environment
        // For now, return empty array
        return [];
    }

    /**
     * Scan a single file
     * @param {Object} file - File object
     * @returns {Promise<Object>} Scan result for the file
     */
    async scanFile(file) {
        await this.semaphore.acquire();
        
        try {
            // Check file size
            if (file.size > this.config.maxFileSize) {
                return { file: file.path, skipped: true, reason: 'File too large' };
            }

            // Check file extension
            const extension = this.getFileExtension(file.path);
            if (this.config.excludeExtensions.includes(extension)) {
                return { file: file.path, skipped: true, reason: 'Excluded extension' };
            }

            // Read file content
            const content = await this.readFileContent(file);
            
            // Scan for patterns
            const matches = this.scanContent(content, file.path);
            
            return {
                file: file.path,
                matches: matches,
                scanned: true
            };
            
        } catch (error) {
            console.error(`Error scanning file ${file.path}:`, error);
            return { file: file.path, error: error.message };
        } finally {
            this.semaphore.release();
        }
    }

    /**
     * Scan content for patterns
     * @param {string} content - File content
     * @param {string} filePath - File path
     * @returns {Array} Array of matches
     */
    scanContent(content, filePath) {
        // This should be implemented by subclasses
        return [];
    }

    /**
     * Process scan results
     * @param {Array} results - Array of settled promises
     */
    processResults(results) {
        this.results = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
            .filter(result => result.scanned && result.matches.length > 0);
    }

    /**
     * Get file extension
     * @param {string} filePath - File path
     * @returns {string} File extension
     */
    getFileExtension(filePath) {
        return filePath.split('.').pop().toLowerCase();
    }

    /**
     * Read file content
     * @param {Object} file - File object
     * @returns {Promise<string>} File content
     */
    async readFileContent(file) {
        // This would be implemented based on the specific environment
        return '';
    }

    /**
     * Get scan statistics
     * @returns {Object} Scan statistics
     */
    getStats() {
        return {
            totalFiles: this.results.length,
            totalMatches: this.results.reduce((sum, result) => sum + result.matches.length, 0),
            isScanning: this.isScanning
        };
    }
}

/**
 * Pattern matcher utility class
 */
class PatternMatcher {
    /**
     * Create a new pattern matcher
     * @param {Array} patterns - Array of patterns to match
     */
    constructor(patterns = []) {
        this.patterns = patterns;
        this.compiledPatterns = this.compilePatterns(patterns);
    }

    /**
     * Compile patterns for efficient matching
     * @param {Array} patterns - Patterns to compile
     * @returns {Array} Compiled patterns
     */
    compilePatterns(patterns) {
        return patterns.map((pattern, index) => {
            try {
                if (typeof pattern === 'string') {
                    console.log(`🔧 Compiling string pattern ${index}:`, pattern);
                    return {
                        regex: new RegExp(pattern, 'gi'),
                        type: 'regex',
                        confidence: 0.8
                    };
                } else if (pattern instanceof RegExp) {
                    console.log(`🔧 Using existing RegExp pattern ${index}:`, pattern);
                    return {
                        regex: pattern,
                        type: 'regex',
                        confidence: 0.8
                    };
                } else if (typeof pattern === 'object') {
                    console.log(`🔧 Compiling object pattern ${index}:`, pattern);
                    if (!pattern.pattern) {
                        console.warn(`⚠️ Pattern ${index} missing 'pattern' property:`, pattern);
                        return null;
                    }
                    return {
                        regex: new RegExp(pattern.pattern, pattern.flags || 'gi'),
                        type: pattern.type || 'regex',
                        confidence: pattern.confidence || 0.8,
                        category: pattern.category || 'general'
                    };
                } else {
                    console.warn(`⚠️ Invalid pattern type ${index}:`, typeof pattern, pattern);
                    return null;
                }
            } catch (error) {
                console.error(`❌ Error compiling pattern ${index}:`, pattern);
                console.error('❌ Error details:', error.message);
                console.error('❌ Pattern type:', typeof pattern);
                console.error('❌ Full pattern object:', JSON.stringify(pattern, null, 2));
                return null;
            }
        }).filter(Boolean);
    }

    /**
     * Match patterns against content
     * @param {string} content - Content to match against
     * @returns {Array} Array of matches
     */
    match(content) {
        const matches = [];

        for (const compiledPattern of this.compiledPatterns) {
            let match;
            while ((match = compiledPattern.regex./* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
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
     * Add new pattern
     * @param {Object|RegExp|string} pattern - Pattern to add
     */
    addPattern(pattern) {
        this.patterns.push(pattern);
        this.compiledPatterns = this.compilePatterns(this.patterns);
    }

    /**
     * Remove pattern
     * @param {number} index - Pattern index to remove
     */
    removePattern(index) {
        this.patterns.splice(index, 1);
        this.compiledPatterns = this.compilePatterns(this.patterns);
    }
}

export { Semaphore, BaseScanner, PatternMatcher };
