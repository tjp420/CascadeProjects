
/**
 * Configuration Validation Script
 * Validates all configuration files for correctness and completeness
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

class ConfigurationValidator {
    constructor() {
        this.results = {
            valid: [],
            invalid: [],
            missing: [],
            warnings: []
        };
        
        this.configFiles = [
            '.gitignore',
            '.env.example',
            'package.json',
            'package-lock.json',
            '.eslintrc',
            '.eslintrc.js',
            '.eslintrc.json',
            '.prettierrc',
            '.prettierrc.json',
            'jest.config.js',
            'tsconfig.json',
            'webpack.config.js',
            'vite.config.js',
            'docker-compose.yml',
            'Dockerfile',
            '.dockerignore',
            'README.md',
            'LICENSE',
            'CONTRIBUTING.md',
            '.gitattributes',
            '.pre-commit-config.yaml',
            '.lintstagedrc.json'
        ];
    }

    async validateAll() {
        console.log('🔍 Validating project configuration...\n');
        
        // Check file existence
        await this.checkFileExistence();
        
        // Validate individual files
        await this.validatePackageJson();
        await this.validateEslintConfigs();
        await this.validatePrettierConfigs();
        await this.validateJestConfig();
        await this.validateTsConfig();
        await this.validateEnvExample();
        await this.validateGitignore();
        await this.validateDockerConfigs();
        await this.validatePrecommitConfig();
        
        // Generate report
        this.generateReport();
        
        // Return validation result
        return {
            success: this.results.invalid.length === 0 && this.results.missing.length === 0,
            results: this.results
        };
    }

    async checkFileExistence() {
        console.log('📁 Checking file existence...');
        
        for (const file of this.configFiles) {
            const filePath = path.join(projectRoot, file);
            const exists = fs.existsSync(filePath);
            
            if (exists) {
                this.results.valid.push({
                    file,
                    type: 'existence',
                    message: 'File exists'
                });
            } else {
                this.results.missing.push({
                    file,
                    type: 'existence',
                    message: 'File is missing'
                });
            }
        }
        
        console.log(`✅ Found: ${this.results.valid.filter(r => r.type === 'existence').length} files`);
        console.log(`❌ Missing: ${this.results.missing.length} files\n`);
    }

    async validatePackageJson() {
        const filePath = path.join(projectRoot, 'package.json');
        
        if (!fs.existsSync(filePath)) {
            return;
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const packageJson = JSON.parse(content);
            
            // Check required fields
            const requiredFields = ['name', 'version', 'description', 'main'];
            for (const field of requiredFields) {
                if (!packageJson[field]) {
                    this.results.invalid.push({
                        file: 'package.json',
                        type: 'content',
                        message: `Missing required field: ${field}`
                    });
                } else {
                    this.results.valid.push({
                        file: 'package.json',
                        type: 'content',
                        message: `Required field present: ${field}`
                    });
                }
            }
            
            // Check scripts
            if (!packageJson.scripts) {
                this.results.warnings.push({
                    file: 'package.json',
                    type: 'content',
                    message: 'No scripts defined'
                });
            } else {
                const essentialScripts = ['dev', 'build', 'test'];
                for (const script of essentialScripts) {
                    if (packageJson.scripts[script]) {
                        this.results.valid.push({
                            file: 'package.json',
                            type: 'content',
                            message: `Essential script present: ${script}`
                        });
                    } else {
                        this.results.warnings.push({
                            file: 'package.json',
                            type: 'content',
                            message: `Missing essential script: ${script}`
                        });
                    }
                }
            }
            
        } catch (error) {
            this.results.invalid.push({
                file: 'package.json',
                type: 'syntax',
                message: `Invalid JSON: ${error.message}`
            });
        }
    }

    async validateEslintConfigs() {
        const eslintConfigs = ['.eslintrc', '.eslintrc.js', '.eslintrc.json'];
        
        for (const config of eslintConfigs) {
            const filePath = path.join(projectRoot, config);
            
            if (!fs.existsSync(filePath)) {
                continue;
            }
            
            try {
                if (config.endsWith('.json')) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    JSON.parse(content);
                    this.results.valid.push({
                        file: config,
                        type: 'syntax',
                        message: 'Valid JSON syntax'
                    });
                } else if (config.endsWith('.js')) {
                    // Basic JavaScript syntax check
                    const content = fs.readFileSync(filePath, 'utf8');
                    if (content.includes('module.exports')) {
                        this.results.valid.push({
                            file: config,
                            type: 'content',
                            message: 'Uses module.exports format'
                        });
                    }
                }
            } catch (error) {
                this.results.invalid.push({
                    file: config,
                    type: 'syntax',
                    message: `Invalid syntax: ${error.message}`
                });
            }
        }
    }

    async validatePrettierConfigs() {
        const prettierConfigs = ['.prettierrc', '.prettierrc.json'];
        
        for (const config of prettierConfigs) {
            const filePath = path.join(projectRoot, config);
            
            if (!fs.existsSync(filePath)) {
                continue;
            }
            
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                
                if (config.endsWith('.json')) {
                    const prettierConfig = JSON.parse(content);
                    const validOptions = ['semi', 'singleQuote', 'tabWidth', 'printWidth', 'trailingComma'];
                    
                    for (const option of validOptions) {
                        if (prettierConfig.hasOwnProperty(option)) {
                            this.results.valid.push({
                                file: config,
                                type: 'content',
                                message: `Valid option: ${option}`
                            });
                        }
                    }
                } else {
                    // YAML format check
                    if (content.includes('semi:') || content.includes('singleQuote:')) {
                        this.results.valid.push({
                            file: config,
                            type: 'content',
                            message: 'Valid YAML format'
                        });
                    }
                }
            } catch (error) {
                this.results.invalid.push({
                    file: config,
                    type: 'syntax',
                    message: `Invalid syntax: ${error.message}`
                });
            }
        }
    }

    async validateJestConfig() {
        const filePath = path.join(projectRoot, 'jest.config.js');
        
        if (!fs.existsSync(filePath)) {
            return;
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for essential Jest configuration
            const essentialOptions = ['testEnvironment', 'setupFilesAfterEnv', 'testMatch'];
            
            for (const option of essentialOptions) {
                if (content.includes(option)) {
                    this.results.valid.push({
                        file: 'jest.config.js',
                        type: 'content',
                        message: `Essential option present: ${option}`
                    });
                }
            }
            
            if (content.includes('coverageThreshold')) {
                this.results.valid.push({
                    file: 'jest.config.js',
                    type: 'content',
                    message: 'Coverage threshold configured'
                });
            }
            
        } catch (error) {
            this.results.invalid.push({
                file: 'jest.config.js',
                type: 'syntax',
                message: `Invalid syntax: ${error.message}`
            });
        }
    }

    async validateTsConfig() {
        const filePath = path.join(projectRoot, 'tsconfig.json');
        
        if (!fs.existsSync(filePath)) {
            return;
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const tsConfig = JSON.parse(content);
            
            // Check for essential TypeScript configuration
            const essentialOptions = ['compilerOptions', 'include', 'exclude'];
            
            for (const option of essentialOptions) {
                if (tsConfig[option]) {
                    this.results.valid.push({
                        file: 'tsconfig.json',
                        type: 'content',
                        message: `Essential option present: ${option}`
                    });
                }
            }
            
            if (tsConfig.compilerOptions) {
                const compilerOptions = ['target', 'module', 'lib', 'strict'];
                for (const option of compilerOptions) {
                    if (tsConfig.compilerOptions[option]) {
                        this.results.valid.push({
                            file: 'tsconfig.json',
                            type: 'content',
                            message: `Compiler option present: ${option}`
                        });
                    }
                }
            }
            
        } catch (error) {
            this.results.invalid.push({
                file: 'tsconfig.json',
                type: 'syntax',
                message: `Invalid JSON: ${error.message}`
            });
        }
    }

    async validateEnvExample() {
        const filePath = path.join(projectRoot, '.env.example');
        
        if (!fs.existsSync(filePath)) {
            return;
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Check for essential environment variables
            const essentialVars = ['API_HOST', 'API_PORT', 'NODE_ENV'];
            const foundVars = [];
            
            for (const line of lines) {
                for (const varName of essentialVars) {
                    if (line.startsWith(`${varName}=`)) {
                        foundVars.push(varName);
                    }
                }
            }
            
            for (const varName of essentialVars) {
                if (foundVars.includes(varName)) {
                    this.results.valid.push({
                        file: '.env.example',
                        type: 'content',
                        message: `Essential variable present: ${varName}`
                    });
                } else {
                    this.results.warnings.push({
                        file: '.env.example',
                        type: 'content',
                        message: `Missing essential variable: ${varName}`
                    });
                }
            }
            
        } catch (error) {
            this.results.invalid.push({
                file: '.env.example',
                type: 'syntax',
                message: `File read error: ${error.message}`
            });
        }
    }

    async validateGitignore() {
        const filePath = path.join(projectRoot, '.gitignore');
        
        if (!fs.existsSync(filePath)) {
            return;
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Check for essential gitignore patterns
            const essentialPatterns = ['node_modules', '.env', 'dist', 'build'];
            const foundPatterns = [];
            
            for (const line of lines) {
                for (const pattern of essentialPatterns) {
                    if (line.trim() === pattern) {
                        foundPatterns.push(pattern);
                    }
                }
            }
            
            for (const pattern of essentialPatterns) {
                if (foundPatterns.includes(pattern)) {
                    this.results.valid.push({
                        file: '.gitignore',
                        type: 'content',
                        message: `Essential pattern present: ${pattern}`
                    });
                } else {
                    this.results.warnings.push({
                        file: '.gitignore',
                        type: 'content',
                        message: `Missing essential pattern: ${pattern}`
                    });
                }
            }
            
        } catch (error) {
            this.results.invalid.push({
                file: '.gitignore',
                type: 'syntax',
                message: `File read error: ${error.message}`
            });
        }
    }

    async validateDockerConfigs() {
        const dockerConfigs = ['Dockerfile', 'docker-compose.yml', '.dockerignore'];
        
        for (const config of dockerConfigs) {
            const filePath = path.join(projectRoot, config);
            
            if (!fs.existsSync(filePath)) {
                continue;
            }
            
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                
                if (config === 'Dockerfile') {
                    if (content.includes('FROM') && content.includes('WORKDIR')) {
                        this.results.valid.push({
                            file: config,
                            type: 'content',
                            message: 'Valid Dockerfile structure'
                        });
                    }
                } else if (config === 'docker-compose.yml') {
                    if (content.includes('version:') && content.includes('services:')) {
                        this.results.valid.push({
                            file: config,
                            type: 'content',
                            message: 'Valid docker-compose structure'
                        });
                    }
                } else if (config === '.dockerignore') {
                    const patterns = ['node_modules', '.git', 'dist'];
                    const foundPatterns = patterns.filter(pattern => content.includes(pattern));
                    
                    if (foundPatterns.length > 0) {
                        this.results.valid.push({
                            file: config,
                            type: 'content',
                            message: `Contains ${foundPatterns.length} ignore patterns`
                        });
                    }
                }
            } catch (error) {
                this.results.invalid.push({
                    file: config,
                    type: 'syntax',
                    message: `File read error: ${error.message}`
                });
            }
        }
    }

    async validatePrecommitConfig() {
        const filePath = path.join(projectRoot, '.pre-commit-config.yaml');
        
        if (!fs.existsSync(filePath)) {
            return;
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            if (content.includes('repos:') && content.includes('hooks:')) {
                this.results.valid.push({
                    file: '.pre-commit-config.yaml',
                    type: 'content',
                    message: 'Valid pre-commit structure'
                });
            } else {
                this.results.invalid.push({
                    file: '.pre-commit-config.yaml',
                    type: 'content',
                    message: 'Invalid pre-commit structure'
                });
            }
        } catch (error) {
            this.results.invalid.push({
                file: '.pre-commit-config.yaml',
                type: 'syntax',
                message: `File read error: ${error.message}`
            });
        }
    }

    generateReport() {
        console.log('📊 Configuration Validation Report\n');
        console.log('=' .repeat(50));
        
        // Summary
        console.log(`✅ Valid: ${this.results.valid.length}`);
        console.log(`❌ Invalid: ${this.results.invalid.length}`);
        console.log(`⚠️  Warnings: ${this.results.warnings.length}`);
        console.log(`📁 Missing: ${this.results.missing.length}`);
        console.log('=' .repeat(50));
        
        // Valid items
        if (this.results.valid.length > 0) {
            console.log('\n✅ Valid Items:');
            this.results.valid.forEach(item => {
                console.log(`  ${item.file}: ${item.message}`);
            });
        }
        
        // Warnings
        if (this.results.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.results.warnings.forEach(item => {
                console.log(`  ${item.file}: ${item.message}`);
            });
        }
        
        // Invalid items
        if (this.results.invalid.length > 0) {
            console.log('\n❌ Invalid Items:');
            this.results.invalid.forEach(item => {
                console.log(`  ${item.file}: ${item.message}`);
            });
        }
        
        // Missing items
        if (this.results.missing.length > 0) {
            console.log('\n📁 Missing Items:');
            this.results.missing.forEach(item => {
                console.log(`  ${item.file}: ${item.message}`);
            });
        }
        
        // Overall status
        const success = this.results.invalid.length === 0 && this.results.missing.length === 0;
        console.log('\n' + '=' .repeat(50));
        console.log(`🎯 Overall Status: ${success ? '✅ PASS' : '❌ FAIL'}`);
        console.log('=' .repeat(50));
    }
}

// Run validation
async function main() {
    const validator = new ConfigurationValidator();
    try {
        const result = await validator.validateAll();
        process.exit(result.success ? 0 : 1);
    } catch (error) {
        console.error('Validation failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('validate-config.js')) {
    main();
}

export default ConfigurationValidator;
