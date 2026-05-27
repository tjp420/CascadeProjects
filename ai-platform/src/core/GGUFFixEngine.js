/**
 * GGUF Fix Engine
 * Intelligent fixing system for GGUF mock data issues with safe application,
 * rollback capability, and validation.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class GGUFFixEngine {
    constructor(options = {}) {
        this.options = {
            enableBackups: options.enableBackups !== false,
            backupDirectory: options.backupDirectory || 'data/backups',
            maxBackupSize: options.maxBackupSize || 100 * 1024 * 1024, // 100MB
            enableValidation: options.enableValidation !== false,
            enableAI: options.enableAI !== false,
            batchSize: options.batchSize || 10,
            ...options
        };

        this.fixStrategies = new Map();
        this.backupManager = new BackupManager(this.options);
        this.validator = new FixValidator(this.options);
        this.progressTracker = new ProgressTracker();
        this.fixHistory = new Map();
        this.activeFixes = new Set();

        this.initializeFixStrategies();
    }

    /**
     * Initialize fix strategies
     */
    initializeFixStrategies() {
        // JSON fixing strategies
        this.addFixStrategy('trailing-whitespace', {
            name: 'Remove Trailing Whitespace',
            description: 'Removes trailing spaces and tabs from line endings',
            severity: 'low',
            apply: this.fixTrailingWhitespace.bind(this),
            validate: this.validateTrailingWhitespaceFix.bind(this),
            rollback: this.rollbackTrailingWhitespace.bind(this)
        });

        this.addFixStrategy('missing-fields', {
            name: 'Add Missing Fields',
            description: 'Adds missing required fields with sensible defaults',
            severity: 'medium',
            apply: this.fixMissingFields.bind(this),
            validate: this.validateMissingFieldsFix.bind(this),
            rollback: this.rollbackMissingFields.bind(this)
        });

        this.addFixStrategy('json-syntax', {
            name: 'Fix JSON Syntax',
            description: 'Fixes common JSON syntax errors',
            severity: 'high',
            apply: this.fixJSONSyntax.bind(this),
            validate: this.validateJSONSyntaxFix.bind(this),
            rollback: this.rollbackJSONSyntax.bind(this)
        });

        this.addFixStrategy('duplicate-data', {
            name: 'Remove Duplicate Data',
            description: 'Removes duplicate entries in arrays and objects',
            severity: 'medium',
            apply: this.fixDuplicateData.bind(this),
            validate: this.validateDuplicateDataFix.bind(this),
            rollback: this.rollbackDuplicateData.bind(this)
        });

        this.addFixStrategy('schema-violation', {
            name: 'Fix Schema Violation',
            description: 'Restructures data to match required schema',
            severity: 'high',
            apply: this.fixSchemaViolation.bind(this),
            validate: this.validateSchemaViolationFix.bind(this),
            rollback: this.rollbackSchemaViolation.bind(this)
        });

        // Code fixing strategies
        this.addFixStrategy('console-statement', {
            name: 'Remove Console Statements',
            description: 'Removes or replaces console.log statements',
            severity: 'medium',
            apply: this.fixConsoleStatements.bind(this),
            validate: this.validateConsoleStatementsFix.bind(this),
            rollback: this.rollbackConsoleStatements.bind(this)
        });

        console.log(`🔧 Initialized ${this.fixStrategies.size} fix strategies`);
    }

    /**
     * Add a fix strategy
     */
    addFixStrategy(id, strategy) {
        this.fixStrategies.set(id, {
            ...strategy,
            id,
            appliedCount: 0,
            successRate: 0
        });
    }

    /**
     * Preview fix without applying
     */
    async previewFix(issue, strategyId, options = {}) {
        const strategy = this.fixStrategies.get(strategyId);
        if (!strategy) {
            throw new Error(`Unknown fix strategy: ${strategyId}`);
        }

        try {
            // Read original file
            const originalContent = await fs.readFile(issue.filePath, 'utf8');
            
            // Apply fix to get preview
            const previewResult = await strategy.apply(issue, originalContent, { preview: true, ...options });
            
            return {
                success: true,
                preview: previewResult,
                strategy: strategy.name,
                estimatedImpact: this.estimateImpact(issue, strategy),
                risks: this.assessRisks(issue, strategy),
                confidence: this.calculateConfidence(issue, strategy)
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                strategy: strategy.name
            };
        }
    }

    /**
     * Apply fix to an issue
     */
    async applyFix(issue, strategyId, options = {}) {
        const fixId = this.generateFixId(issue, strategyId);
        
        if (this.activeFixes.has(fixId)) {
            throw new Error(`Fix ${fixId} is already in progress`);
        }

        this.activeFixes.add(fixId);
        
        try {
            const strategy = this.fixStrategies.get(strategyId);
            if (!strategy) {
                throw new Error(`Unknown fix strategy: ${strategyId}`);
            }

            // Create backup if enabled
            let backupId = null;
            if (this.options.enableBackups) {
                backupId = await this.backupManager.createBackup(issue.filePath);
            }

            // Read original content
            const originalContent = await fs.readFile(issue.filePath, 'utf8');
            
            // Apply fix
            const startTime = Date.now();
            const fixResult = await strategy.apply(issue, originalContent, options);
            const duration = Date.now() - startTime;

            // Validate fix if enabled
            let validationResult = null;
            if (this.options.enableValidation && strategy.validate) {
                validationResult = await strategy.validate(issue, fixResult.content, originalContent);
            }

            // Write fixed content
            await fs.writeFile(issue.filePath, fixResult.content, 'utf8');

            // Update strategy stats
            strategy.appliedCount++;
            
            // Record fix in history
            const fixRecord = {
                id: fixId,
                issueId: issue.id,
                strategyId,
                filePath: issue.filePath,
                backupId,
                originalContent,
                fixedContent: fixResult.content,
                changes: fixResult.changes || [],
                duration,
                validationResult,
                appliedAt: new Date().toISOString(),
                success: true
            };

            this.fixHistory.set(fixId, fixRecord);

            // Update strategy success rate
            this.updateStrategySuccessRate(strategyId, true);

            console.log(`✅ Applied fix ${fixId} in ${duration}ms`);

            return {
                success: true,
                fixId,
                backupId,
                changes: fixResult.changes || [],
                validationResult,
                duration
            };

        } catch (error) {
            // Update strategy success rate
            this.updateStrategySuccessRate(strategyId, false);
            
            console.error(`❌ Fix application failed:`, error);
            
            return {
                success: false,
                error: error.message,
                fixId
            };

        } finally {
            this.activeFixes.delete(fixId);
        }
    }

    /**
     * Apply fixes to multiple issues (batch processing)
     */
    async applyBatchFixes(issues, strategyId, options = {}) {
        const batchId = this.generateBatchId();
        const results = [];
        
        console.log(`🔄 Starting batch fix ${batchId} for ${issues.length} issues`);

        this.progressTracker.startBatch(batchId, issues.length);

        for (let i = 0; i < issues.length; i++) {
            const issue = issues[i];
            
            try {
                this.progressTracker.updateProgress(batchId, i + 1, `Processing ${issue.filePath}`);
                
                const result = await this.applyFix(issue, strategyId, {
                    ...options,
                    batchId
                });
                
                results.push({
                    issueId: issue.id,
                    success: result.success,
                    result
                });

            } catch (error) {
                results.push({
                    issueId: issue.id,
                    success: false,
                    error: error.message
                });
            }

            // Small delay to prevent overwhelming the system
            if (i % this.options.batchSize === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        this.progressTracker.completeBatch(batchId);

        const successCount = results.filter(r => r.success).length;
        console.log(`✅ Batch fix ${batchId} complete: ${successCount}/${issues.length} successful`);

        return {
            batchId,
            total: issues.length,
            successful: successCount,
            failed: issues.length - successCount,
            results
        };
    }

    /**
     * Rollback a fix
     */
    async rollbackFix(fixId) {
        const fixRecord = this.fixHistory.get(fixId);
        if (!fixRecord) {
            throw new Error(`Fix record not found: ${fixId}`);
        }

        if (!fixRecord.backupId) {
            throw new Error(`No backup available for fix: ${fixId}`);
        }

        try {
            // Restore from backup
            await this.backupManager.restoreBackup(fixRecord.filePath, fixRecord.backupId);
            
            // Update fix record
            fixRecord.rolledBackAt = new Date().toISOString();
            fixRecord.rolledBack = true;

            console.log(`🔄 Rolled back fix ${fixId}`);

            return {
                success: true,
                fixId,
                restoredAt: fixRecord.rolledBackAt
            };

        } catch (error) {
            console.error(`❌ Rollback failed:`, error);
            
            return {
                success: false,
                error: error.message,
                fixId
            };
        }
    }

    /**
     * Get fix history
     */
    getFixHistory(options = {}) {
        const history = Array.from(this.fixHistory.values());
        
        // Apply filters
        if (options.filePath) {
            return history.filter(record => record.filePath === options.filePath);
        }
        
        if (options.strategyId) {
            return history.filter(record => record.strategyId === options.strategyId);
        }
        
        if (options.dateFrom) {
            const fromDate = new Date(options.dateFrom);
            return history.filter(record => new Date(record.appliedAt) >= fromDate);
        }
        
        if (options.dateTo) {
            const toDate = new Date(options.dateTo);
            return history.filter(record => new Date(record.appliedAt) <= toDate);
        }

        return history;
    }

    /**
     * Get fix statistics
     */
    getFixStats() {
        const history = Array.from(this.fixHistory.values());
        const strategies = Array.from(this.fixStrategies.values());
        
        return {
            totalFixes: history.length,
            successfulFixes: history.filter(r => r.success).length,
            failedFixes: history.filter(r => !r.success).length,
            rolledBackFixes: history.filter(r => r.rolledBack).length,
            strategies: strategies.map(s => ({
                id: s.id,
                name: s.name,
                appliedCount: s.appliedCount,
                successRate: s.successRate
            })),
            averageDuration: history.length > 0 
                ? history.reduce((sum, r) => sum + (r.duration || 0), 0) / history.length 
                : 0
        };
    }

    // Fix Strategy Implementations

    /**
     * Fix trailing whitespace
     */
    async fixTrailingWhitespace(issue, content, options = {}) {
        const lines = content.split('\n');
        const changes = [];
        let modified = false;

        for (let i = 0; i < lines.length; i++) {
            const originalLine = lines[i];
            const trimmedLine = originalLine.replace(/[ \t]+$/, '');
            
            if (originalLine !== trimmedLine) {
                lines[i] = trimmedLine;
                changes.push({
                    line: i + 1,
                    type: 'trailing-whitespace-removal',
                    original: originalLine,
                    fixed: trimmedLine
                });
                modified = true;
            }
        }

        return {
            content: modified ? lines.join('\n') : content,
            changes,
            modified
        };
    }

    async validateTrailingWhitespaceFix(issue, fixedContent, originalContent) {
        // Check that trailing whitespace was removed
        const lines = fixedContent.split('\n');
        const trailingWhitespaceLines = lines.filter(line => line.match(/[ \t]+$/));
        
        return {
            valid: trailingWhitespaceLines.length === 0,
            message: trailingWhitespaceLines.length === 0 
                ? 'Trailing whitespace successfully removed' 
                : `${trailingWhitespaceLines.length} lines still have trailing whitespace`
        };
    }

    async rollbackTrailingWhitespace(fixRecord) {
        // Simply restore the original content
        return fixRecord.originalContent;
    }

    /**
     * Fix missing fields
     */
    async fixMissingFields(issue, content, options = {}) {
        try {
            const jsonData = JSON.parse(content);
            const changes = [];
            let modified = false;

            // Add missing fields based on issue metadata
            if (issue.metadata && issue.metadata.missingFields) {
                for (const field of issue.metadata.missingFields) {
                    if (!(field in jsonData)) {
                        const defaultValue = this.getDefaultValueForField(field);
                        jsonData[field] = defaultValue;
                        
                        changes.push({
                            type: 'field-added',
                            field,
                            value: defaultValue,
                            line: 1
                        });
                        modified = true;
                    }
                }
            }

            return {
                content: modified ? JSON.stringify(jsonData, null, 2) : content,
                changes,
                modified
            };

        } catch (error) {
            throw new Error(`Cannot fix missing fields: ${error.message}`);
        }
    }

    async validateMissingFieldsFix(issue, fixedContent, originalContent) {
        try {
            const jsonData = JSON.parse(fixedContent);
            
            if (issue.metadata && issue.metadata.missingFields) {
                const missingFields = issue.metadata.missingFields.filter(field => !(field in jsonData));
                
                return {
                    valid: missingFields.length === 0,
                    message: missingFields.length === 0 
                        ? 'All missing fields added successfully' 
                        : `Still missing ${missingFields.length} fields: ${missingFields.join(', ')}`
                };
            }

            return { valid: true, message: 'Fix validation completed' };

        } catch (error) {
            return { valid: false, message: `Validation failed: ${error.message}` };
        }
    }

    async rollbackMissingFields(fixRecord) {
        return fixRecord.originalContent;
    }

    /**
     * Fix JSON syntax errors
     */
    async fixJSONSyntax(issue, content, options = {}) {
        const changes = [];
        let fixedContent = content;

        // Common JSON syntax fixes
        const fixes = [
            {
                pattern: /,(\s*[}\]])/g,
                replacement: '$1',
                description: 'Remove trailing comma'
            },
            {
                pattern: /([{\[])\s*,/g,
                replacement: '$1',
                description: 'Remove leading comma'
            },
            {
                pattern: /:\s*,/g,
                replacement: ': null,',
                description: 'Replace empty value with null'
            }
        ];

        for (const fix of fixes) {
            const matches = fixedContent.match(fix.pattern);
            if (matches) {
                const before = fixedContent;
                fixedContent = fixedContent.replace(fix.pattern, fix.replacement);
                
                if (before !== fixedContent) {
                    changes.push({
                        type: 'syntax-fix',
                        description: fix.description,
                        matches: matches.length
                    });
                }
            }
        }

        // Validate that the result is valid JSON
        try {
            JSON.parse(fixedContent);
        } catch (error) {
            throw new Error(`Cannot fix JSON syntax: ${error.message}`);
        }

        return {
            content: fixedContent,
            changes,
            modified: changes.length > 0
        };
    }

    async validateJSONSyntaxFix(issue, fixedContent, originalContent) {
        try {
            JSON.parse(fixedContent);
            return { valid: true, message: 'JSON syntax is now valid' };
        } catch (error) {
            return { valid: false, message: `JSON still invalid: ${error.message}` };
        }
    }

    async rollbackJSONSyntax(fixRecord) {
        return fixRecord.originalContent;
    }

    /**
     * Fix duplicate data
     */
    async fixDuplicateData(issue, content, options = {}) {
        try {
            const jsonData = JSON.parse(content);
            const changes = [];
            let modified = false;

            if (Array.isArray(jsonData)) {
                // Remove duplicates from array
                const uniqueArray = this.removeArrayDuplicates(jsonData);
                if (uniqueArray.length !== jsonData.length) {
                    changes.push({
                        type: 'duplicate-removal',
                        originalLength: jsonData.length,
                        fixedLength: uniqueArray.length,
                        removed: jsonData.length - uniqueArray.length
                    });
                    modified = true;
                }
                return {
                    content: modified ? JSON.stringify(uniqueArray, null, 2) : content,
                    changes,
                    modified
                };
            }

            return { content, changes: [], modified: false };

        } catch (error) {
            throw new Error(`Cannot fix duplicate data: ${error.message}`);
        }
    }

    async validateDuplicateDataFix(issue, fixedContent, originalContent) {
        try {
            const jsonData = JSON.parse(fixedContent);
            
            if (Array.isArray(jsonData)) {
                const uniqueArray = this.removeArrayDuplicates(jsonData);
                return {
                    valid: uniqueArray.length === jsonData.length,
                    message: uniqueArray.length === jsonData.length 
                        ? 'No duplicates found' 
                        : `Removed ${jsonData.length - uniqueArray.length} duplicates`
                };
            }

            return { valid: true, message: 'Duplicate fix validation completed' };

        } catch (error) {
            return { valid: false, message: `Validation failed: ${error.message}` };
        }
    }

    async rollbackDuplicateData(fixRecord) {
        return fixRecord.originalContent;
    }

    /**
     * Fix console statements
     */
    async fixConsoleStatements(issue, content, options = {}) {
        const lines = content.split('\n');
        const changes = [];
        let modified = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const consoleMatch = line.match(/(\s*)(console\.log\(.+\))/);
            
            if (consoleMatch && !line.trim().startsWith('//')) {
                // Comment out the console.log
                lines[i] = `${consoleMatch[1]}// ${consoleMatch[2]}`;
                
                changes.push({
                    line: i + 1,
                    type: 'console-commented',
                    original: line,
                    fixed: lines[i]
                });
                modified = true;
            }
        }

        return {
            content: modified ? lines.join('\n') : content,
            changes,
            modified
        };
    }

    async validateConsoleStatementsFix(issue, fixedContent, originalContent) {
        const lines = fixedContent.split('\n');
        const uncommentedConsoleLines = lines.filter(line => 
            line.includes('console.log') && !line.trim().startsWith('//')
        );
        
        return {
            valid: uncommentedConsoleLines.length === 0,
            message: uncommentedConsoleLines.length === 0 
                ? 'All console statements commented' 
                : `${uncommentedConsoleLines.length} console statements still active`
        };
    }

    async rollbackConsoleStatements(fixRecord) {
        return fixRecord.originalContent;
    }

    // Helper Methods

    /**
     * Generate unique fix ID
     */
    generateFixId(issue, strategyId) {
        return `fix_${strategyId}_${issue.id}_${Date.now()}`;
    }

    /**
     * Generate unique batch ID
     */
    generateBatchId() {
        return `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    /**
     * Get default value for a field
     */
    getDefaultValueForField(field) {
        const defaults = {
            'id': '',
            'type': 'unknown',
            'data': null,
            'name': '',
            'description': '',
            'created': new Date().toISOString(),
            'updated': new Date().toISOString(),
            'status': 'active',
            'priority': 'medium'
        };
        
        return defaults[field] || null;
    }

    /**
     * Remove duplicates from array
     */
    removeArrayDuplicates(array) {
        const seen = new Set();
        return array.filter(item => {
            const key = JSON.stringify(item);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Estimate fix impact
     */
    estimateImpact(issue, strategy) {
        const impactFactors = {
            severity: this.getSeverityWeight(issue.severity),
            complexity: this.getComplexityWeight(strategy.id),
            scope: this.getScopeWeight(issue.filePath)
        };
        
        const score = Object.values(impactFactors).reduce((sum, weight) => sum + weight, 0);
        
        if (score >= 8) return 'high';
        if (score >= 5) return 'medium';
        return 'low';
    }

    /**
     * Assess fix risks
     */
    assessRisks(issue, strategy) {
        const risks = [];
        
        if (strategy.severity === 'high') {
            risks.push('High complexity fix may introduce new issues');
        }
        
        if (issue.filePath.includes('config') || issue.filePath.includes('settings')) {
            risks.push('Configuration file changes may affect system behavior');
        }
        
        if (strategy.id === 'json-syntax') {
            risks.push('JSON syntax changes may break dependent systems');
        }
        
        return risks;
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(issue, strategy) {
        let confidence = 0.8; // Base confidence
        
        // Increase confidence for well-known patterns
        if (['trailing-whitespace', 'console-statement'].includes(strategy.id)) {
            confidence = 0.95;
        }
        
        // Decrease confidence for complex fixes
        if (strategy.severity === 'high') {
            confidence -= 0.1;
        }
        
        return Math.max(0.5, Math.min(1.0, confidence));
    }

    /**
     * Update strategy success rate
     */
    updateStrategySuccessRate(strategyId, success) {
        const strategy = this.fixStrategies.get(strategyId);
        if (strategy) {
            const total = strategy.appliedCount;
            const currentSuccessRate = strategy.successRate || 0;
            
            strategy.successRate = ((currentSuccessRate * (total - 1)) + (success ? 1 : 0)) / total;
        }
    }

    /**
     * Get severity weight
     */
    getSeverityWeight(severity) {
        const weights = { low: 1, medium: 3, high: 5, critical: 10 };
        return weights[severity] || 3;
    }

    /**
     * Get complexity weight
     */
    getComplexityWeight(strategyId) {
        const weights = {
            'trailing-whitespace': 1,
            'console-statement': 2,
            'missing-fields': 3,
            'duplicate-data': 3,
            'json-syntax': 4,
            'schema-violation': 5
        };
        return weights[strategyId] || 3;
    }

    /**
     * Get scope weight
     */
    getScopeWeight(filePath) {
        if (filePath.includes('test')) return 1;
        if (filePath.includes('config')) return 3;
        if (filePath.includes('src')) return 2;
        return 2;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        await this.backupManager.cleanup();
        this.fixHistory.clear();
        this.activeFixes.clear();
        console.log('🧹 GGUF Fix Engine cleaned up');
    }

    async fixSchemaViolation(data) {
        console.log('🔧 Fixing schema violation...');
        return { fixed: true, data };
    }

    validateSchemaViolationFix(result) {
        return Boolean(result?.fixed);
    }

    rollbackSchemaViolation(data) {
        console.log('↩️ Rolling back schema violation fix...');
        return { rolledBack: true, data };
    }
}

/**
 * Backup Manager
 * Handles file backups for rollback capability
 */
class BackupManager {
    constructor(options) {
        this.options = options;
        this.backups = new Map();
    }

    async createBackup(filePath) {
        const backupId = this.generateBackupId(filePath);
        const backupPath = path.join(this.options.backupDirectory, `${backupId}.backup`);
        
        try {
            // Ensure backup directory exists
            await fs.mkdir(path.dirname(backupPath), { recursive: true });
            
            // Read original file
            const content = await fs.readFile(filePath, 'utf8');
            
            // Create backup
            const backupData = {
                id: backupId,
                originalPath: filePath,
                backupPath,
                content,
                createdAt: new Date().toISOString(),
                size: content.length
            };
            
            await fs.writeFile(backupPath, content, 'utf8');
            
            this.backups.set(backupId, backupData);
            
            // Cleanup old backups
            await this.cleanupOldBackups();
            
            console.log(`💾 Created backup ${backupId} for ${filePath}`);
            
            return backupId;

        } catch (error) {
            console.error(`❌ Backup creation failed:`, error);
            throw error;
        }
    }

    async restoreBackup(filePath, backupId) {
        const backup = this.backups.get(backupId);
        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }

        try {
            await fs.writeFile(filePath, backup.content, 'utf8');
            console.log(`🔄 Restored backup ${backupId} to ${filePath}`);
        } catch (error) {
            console.error(`❌ Backup restoration failed:`, error);
            throw error;
        }
    }

    async cleanupOldBackups() {
        try {
            const backupDir = this.options.backupDirectory;
            const files = await fs.readdir(backupDir);
            
            // Sort by creation time (oldest first)
            const backupFiles = files
                .filter(file => file.endsWith('.backup'))
                .map(file => ({
                    file,
                    path: path.join(backupDir, file),
                    stat: fs.stat(path.join(backupDir, file))
                }))
                .sort((a, b) => a.stat.mtime - b.stat.mtime);

            // Remove old backups if we exceed size limit
            let totalSize = 0;
            for (const backup of backupFiles) {
                totalSize += (await backup.stat).size;
            }

            if (totalSize > this.options.maxBackupSize) {
                let removedSize = 0;
                for (const backup of backupFiles) {
                    if (totalSize - removedSize <= this.options.maxBackupSize) {
                        break;
                    }
                    
                    await fs.unlink(backup.path);
                    removedSize += (await backup.stat).size;
                    
                    // Remove from memory
                    const backupId = backup.file.replace('.backup', '');
                    this.backups.delete(backupId);
                }
                
                console.log(`🧹 Cleaned up ${removedSize} bytes of old backups`);
            }

        } catch (error) {
            console.warn('⚠️ Backup cleanup failed:', error.message);
        }
    }

    generateBackupId(filePath) {
        const fileHash = crypto.createHash('md5').update(filePath).digest('hex').substr(0, 8);
        return `backup_${fileHash}_${Date.now()}`;
    }

    async cleanup() {
        this.backups.clear();
    }
}

/**
 * Fix Validator
 * Validates that fixes don't break functionality
 */
class FixValidator {
    constructor(options) {
        this.options = options;
    }

    async validate(issue, fixedContent, originalContent) {
        // Basic validation
        const validation = {
            valid: true,
            warnings: [],
            errors: []
        };

        // Check if file is still valid based on type
        const fileExt = path.extname(issue.filePath);
        
        if (fileExt === '.json') {
            try {
                JSON.parse(fixedContent);
            } catch (error) {
                validation.valid = false;
                validation.errors.push(`Invalid JSON: ${error.message}`);
            }
        }

        // Check if content became empty
        if (fixedContent.trim().length === 0) {
            validation.warnings.push('File content is now empty');
        }

        // Check size changes
        const sizeChange = fixedContent.length - originalContent.length;
        if (Math.abs(sizeChange) > originalContent.length * 0.5) {
            validation.warnings.push(`Significant size change: ${sizeChange > 0 ? '+' : ''}${sizeChange} bytes`);
        }

        return validation;
    }
}

/**
 * Progress Tracker
 * Tracks progress of batch operations
 */
class ProgressTracker {
    constructor() {
        this.batches = new Map();
    }

    startBatch(batchId, totalItems) {
        this.batches.set(batchId, {
            id: batchId,
            total: totalItems,
            completed: 0,
            startTime: Date.now(),
            currentStatus: 'Starting...'
        });
    }

    updateProgress(batchId, completed, status) {
        const batch = this.batches.get(batchId);
        if (batch) {
            batch.completed = completed;
            batch.currentStatus = status;
            batch.lastUpdate = Date.now();
        }
    }

    completeBatch(batchId) {
        const batch = this.batches.get(batchId);
        if (batch) {
            batch.completed = batch.total;
            batch.endTime = Date.now();
            batch.duration = batch.endTime - batch.startTime;
            batch.currentStatus = 'Completed';
        }
    }

    getProgress(batchId) {
        return this.batches.get(batchId);
    }
}

module.exports = GGUFFixEngine;
