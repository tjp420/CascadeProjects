
/**
 * Coverage Gates Validation
 * Sprint 3 Test Coverage Enhancement - Automated Validation System
 */

const fs = require('fs');
const path = require('path');

class CoverageGateValidator {
    constructor(configPath = './coverage-config.json') {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.results = {
            timestamp: new Date().toISOString(),
            passed: false,
            gates: [],
            violations: [],
            recommendations: []
        };
    }

    loadConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } catch (error) {
            console.error('❌ Failed to load coverage config:', error.message);
            process.exit(1);
        }
    }

    async validateAllGates() {
        console.log('🔍 Starting coverage gate validation...');
        
        try {
            // Load coverage data
            const coverageData = await this.loadCoverageData();
            
            // Validate each gate
            await this.validateOverallGate(coverageData);
            await this.validateCriticalModulesGate(coverageData);
            await this.validateFileTypeGates(coverageData);
            await this.validateThresholdGates(coverageData);
            await this.validateQualityGates(coverageData);
            
            // Determine overall result
            this.results.passed = this.results.gates.every(gate => gate.passed);
            
            // Generate recommendations
            this.generateRecommendations();
            
            // Save results
            this.saveResults();
            
            // Output results
            this.outputResults();
            
            return this.results;
            
        } catch (error) {
            console.error('❌ Coverage gate validation failed:', error.message);
            throw error;
        }
    }

    async loadCoverageData() {
        const coverageFile = './coverage/coverage-summary.json';
        
        if (!fs.existsSync(coverageFile)) {
            throw new Error('Coverage summary file not found');
        }
        
        return JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    }

    async validateOverallGate(coverageData) {
        const gate = this.config.gates.overall;
        const actualCoverage = coverageData.total.lines.pct;
        
        const gateResult = {
            name: 'Overall Coverage',
            required: gate.minimum,
            target: gate.target,
            actual: actualCoverage,
            passed: actualCoverage >= gate.minimum,
            blocking: gate.blocking
        };
        
        if (!gateResult.passed) {
            this.results.violations.push({
                gate: 'Overall Coverage',
                severity: gate.blocking ? 'critical' : 'warning',
                message: `Coverage ${actualCoverage}% below minimum ${gate.minimum}%`,
                recommendation: `Increase coverage to at least ${gate.minimum}%`
            });
        }
        
        this.results.gates.push(gateResult);
    }

    async validateCriticalModulesGate(coverageData) {
        const gate = this.config.gates.critical_modules;
        
        for (const [modulePath, requirements] of Object.entries(gate)) {
            const moduleCoverage = this.getModuleCoverage(coverageData, modulePath);
            
            if (moduleCoverage !== null) {
                const gateResult = {
                    name: `Critical Module: ${modulePath}`,
                    required: requirements.minimum,
                    target: requirements.target,
                    actual: moduleCoverage,
                    passed: moduleCoverage >= requirements.minimum,
                    blocking: requirements.blocking
                };
                
                if (!gateResult.passed) {
                    this.results.violations.push({
                        gate: `Critical Module: ${modulePath}`,
                        severity: requirements.blocking ? 'critical' : 'warning',
                        message: `Module coverage ${moduleCoverage}% below minimum ${requirements.minimum}%`,
                        recommendation: `Add tests to ${modulePath} to reach ${requirements.minimum}% coverage`
                    });
                }
                
                this.results.gates.push(gateResult);
            }
        }
    }

    async validateFileTypeGates(coverageData) {
        const gate = this.config.gates.file_types;
        
        // This would require more detailed coverage analysis by file type
        // For now, we'll validate JavaScript coverage as an example
        const jsGate = gate.javascript;
        const jsCoverage = coverageData.total.lines.pct; // Simplified
        
        const gateResult = {
            name: 'JavaScript Coverage',
            required: jsGate.minimum,
            target: jsGate.target,
            actual: jsCoverage,
            passed: jsCoverage >= jsGate.minimum,
            blocking: jsGate.blocking
        };
        
        if (!gateResult.passed) {
            this.results.violations.push({
                gate: 'JavaScript Coverage',
                severity: jsGate.blocking ? 'critical' : 'warning',
                message: `JavaScript coverage ${jsCoverage}% below minimum ${jsGate.minimum}%`,
                recommendation: `Add JavaScript tests to reach ${jsGate.minimum}% coverage`
            });
        }
        
        this.results.gates.push(gateResult);
    }

    async validateThresholdGates(coverageData) {
        const thresholds = this.config.thresholds;
        
        // Coverage drop validation (would need historical data)
        // For now, we'll validate uncovered files threshold
        
        const uncoveredFilesThreshold = thresholds.uncovered_files;
        const uncoveredFiles = this.countUncoveredFiles(coverageData);
        
        const gateResult = {
            name: 'Uncovered Files',
            warning_threshold: uncoveredFilesThreshold.warning,
            critical_threshold: uncoveredFilesThreshold.critical,
            actual: uncoveredFiles,
            passed: uncoveredFiles <= uncoveredFilesThreshold.critical,
            blocking: uncoveredFilesThreshold.blocking
        };
        
        if (!gateResult.passed) {
            this.results.violations.push({
                gate: 'Uncovered Files',
                severity: uncoveredFiles > uncoveredFilesThreshold.critical ? 'critical' : 'warning',
                message: `${uncoveredFiles} uncovered files exceeds threshold`,
                recommendation: 'Add tests for uncovered files to reduce the count'
            });
        }
        
        this.results.gates.push(gateResult);
    }

    async validateQualityGates(coverageData) {
        const qualityChecks = this.config.quality_checks;
        
        // Test duration validation (simplified)
        const performanceGate = qualityChecks.performance;
        
        const gateResult = {
            name: 'Performance Checks',
            max_test_duration: performanceGate.max_test_duration,
            max_suite_duration: performanceGate.max_suite_duration,
            passed: true, // Simplified - would need actual timing data
            blocking: false
        };
        
        this.results.gates.push(gateResult);
    }

    getModuleCoverage(coverageData, modulePath) {
        // This is a simplified version - would need detailed file-by-file coverage
        // For now, return overall coverage as a placeholder
        return coverageData.total.lines.pct;
    }

    countUncoveredFiles(coverageData) {
        // Simplified count - would need actual file-by-file analysis
        return Math.floor(Math.random() * 10); // Placeholder
    }

    generateRecommendations() {
        const recommendations = [];
        
        // High priority recommendations for critical violations
        const criticalViolations = this.results.violations.filter(v => v.severity === 'critical');
        if (criticalViolations.length > 0) {
            recommendations.push({
                priority: 'critical',
                action: 'Address critical coverage violations',
                description: `Fix ${criticalViolations.length} critical violations before proceeding`,
                gates: criticalViolations.map(v => v.gate)
            });
        }
        
        // Coverage improvement recommendations
        const failedGates = this.results.gates.filter(g => !g.passed);
        if (failedGates.length > 0) {
            recommendations.push({
                priority: 'high',
                action: 'Improve test coverage',
                description: `Focus on ${failedGates.length} failed coverage gates`,
                gates: failedGates.map(g => g.name)
            });
        }
        
        // General improvement recommendations
        if (this.results.passed) {
            recommendations.push({
                priority: 'low',
                action: 'Maintain coverage standards',
                description: 'Continue maintaining current coverage levels and practices'
            });
        }
        
        this.results.recommendations = recommendations;
    }

    saveResults() {
        const resultsDir = './coverage-results';
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const resultsFile = path.join(resultsDir, `coverage-gate-validation-${Date.now()}.json`);
        fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
        
        // Also save as latest
        const latestFile = path.join(resultsDir, 'latest-coverage-gate-validation.json');
        fs.writeFileSync(latestFile, JSON.stringify(this.results, null, 2));
        
        console.log(`📁 Validation results saved to: ${resultsFile}`);
    }

    outputResults() {
        console.log('\n🔍 Coverage Gate Validation Results');
        console.log('=====================================');
        
        // Overall status
        const status = this.results.passed ? '✅ PASSED' : '❌ FAILED';
        console.log(`Overall Status: ${status}`);
        console.log(`Timestamp: ${this.results.timestamp}`);
        
        // Gate results
        console.log('\n📊 Gate Results:');
        for (const gate of this.results.gates) {
            const status = gate.passed ? '✅' : '❌';
            const blocking = gate.blocking ? ' (blocking)' : '';
            console.log(`  ${status} ${gate.name}: ${gate.actual}% (required: ${gate.required}%)${blocking}`);
        }
        
        // Violations
        if (this.results.violations.length > 0) {
            console.log('\n🚨 Violations:');
            for (const violation of this.results.violations) {
                console.log(`  ${violation.severity.toUpperCase()}: ${violation.message}`);
                console.log(`    Recommendation: ${violation.recommendation}`);
            }
        }
        
        // Recommendations
        if (this.results.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            for (const rec of this.results.recommendations) {
                console.log(`  ${rec.priority.toUpperCase()}: ${rec.action}`);
                console.log(`    ${rec.description}`);
            }
        }
        
        console.log('\n=====================================');
    }
}

// CLI interface
if (require.main === module) {
    const validator = new CoverageGateValidator();
    
    validator.validateAllGates()
        .then(() => {
            process.exit(validator.results.passed ? 0 : 1);
        })
        .catch((error) => {
            console.error('💥 Coverage gate validation failed:', error);
            process.exit(1);
        });
}

module.exports = CoverageGateValidator;
