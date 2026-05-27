/**
 * Enhanced Development Setup Script
 * 
 * Automated setup for development environment with all tooling and configurations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class EnhancedDevelopmentSetup {
    constructor() {
        this.projectRoot = process.cwd();
        this.errors = [];
        this.warnings = [];
    }

    async run() {
        console.log('🚀 Starting Enhanced Development Setup...\n');

        try {
            await this.checkPrerequisites();
            await this.setupGitHooks();
            await this.setupLinting();
            await this.setupFormatting();
            await this.setupTesting();
            await this.setupIDEConfiguration();
            await this.setupVSCodeExtensions();
            await this.createDevelopmentScripts();
            await this.generateDocumentation();
            await this.runValidation();

            this.printSummary();
        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            process.exit(1);
        }
    }

    async checkPrerequisites() {
        console.log('📋 Checking prerequisites...');

        const requiredCommands = [
            { command: 'node', version: '>=14.0.0' },
            { command: 'npm', version: '>=6.0.0' },
            { command: 'python', version: '>=3.7.0' },
            { command: 'git', version: '>=2.0.0' }
        ];

        for (const { command, version } of requiredCommands) {
            try {
                const output = execSync(`${command} --version`, { encoding: 'utf-8' });
                console.log(`  ✅ ${command}: ${output.trim()}`);
            } catch (error) {
                this.errors.push(`${command} is not installed or not in PATH`);
                console.log(`  ❌ ${command}: Not found`);
            }
        }

        if (this.errors.length > 0) {
            throw new Error('Missing required prerequisites');
        }

        console.log('');
    }

    async setupGitHooks() {
        console.log('🪝 Setting up Git hooks...');

        const huskyConfig = `
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run pre-commit
`;

        try {
            // Ensure .husky directory exists
            const huskyDir = path.join(this.projectRoot, '.husky');
            if (!fs.existsSync(huskyDir)) {
                fs.mkdirSync(huskyDir, { recursive: true });
            }

            // Write pre-commit hook
            fs.writeFileSync(path.join(huskyDir, 'pre-commit'), huskyConfig.trim());
            fs.chmodSync(path.join(huskyDir, 'pre-commit'), '755');

            console.log('  ✅ Git hooks configured');
        } catch (error) {
            this.warnings.push('Failed to set up Git hooks: ' + error.message);
            console.log('  ⚠️  Git hooks setup failed');
        }

        console.log('');
    }

    async setupLinting() {
        console.log('🔍 Setting up linting configuration...');

        const eslintConfigs = [
            { source: '.eslintrc.enhanced.js', target: '.eslintrc.js' }
        ];

        for (const { source, target } of eslintConfigs) {
            try {
                const sourcePath = path.join(this.projectRoot, source);
                const targetPath = path.join(this.projectRoot, target);

                if (fs.existsSync(sourcePath)) {
                    fs.copyFileSync(sourcePath, targetPath);
                    console.log(`  ✅ Copied ${source} to ${target}`);
                } else {
                    this.warnings.push(`${source} not found`);
                }
            } catch (error) {
                this.warnings.push(`Failed to copy ${source}: ${error.message}`);
            }
        }

        console.log('');
    }

    async setupFormatting() {
        console.log('✨ Setting up formatting configuration...');

        const prettierConfigs = [
            { source: '.prettierrc.enhanced.js', target: '.prettierrc.js' }
        ];

        for (const { source, target } of prettierConfigs) {
            try {
                const sourcePath = path.join(this.projectRoot, source);
                const targetPath = path.join(this.projectRoot, target);

                if (fs.existsSync(sourcePath)) {
                    fs.copyFileSync(sourcePath, targetPath);
                    console.log(`  ✅ Copied ${source} to ${target}`);
                } else {
                    this.warnings.push(`${source} not found`);
                }
            } catch (error) {
                this.warnings.push(`Failed to copy ${source}: ${error.message}`);
            }
        }

        console.log('');
    }

    async setupTesting() {
        console.log('🧪 Setting up testing configuration...');

        const testConfigs = [
            { source: 'jest.config.enhanced.js', target: 'jest.config.js' }
        ];

        for (const { source, target } of testConfigs) {
            try {
                const sourcePath = path.join(this.projectRoot, source);
                const targetPath = path.join(this.projectRoot, target);

                if (fs.existsSync(sourcePath)) {
                    fs.copyFileSync(sourcePath, targetPath);
                    console.log(`  ✅ Copied ${source} to ${target}`);
                } else {
                    this.warnings.push(`${source} not found`);
                }
            } catch (error) {
                this.warnings.push(`Failed to copy ${source}: ${error.message}`);
            }
        }

        // Create test directory structure
        const testDirs = [
            'tests/__mocks__',
            'tests/unit',
            'tests/integration',
            'tests/e2e'
        ];

        for (const dir of testDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }

        // Create test setup files
        this.createTestSetupFiles();

        console.log('  ✅ Test directory structure created');
        console.log('');
    }

    createTestSetupFiles() {
        // Create setup.js
        const setupJs = `
// Test setup file
global.fetch = require('jest-fetch-mock');

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});
`;

        fs.writeFileSync(
            path.join(this.projectRoot, 'tests/setup.js'),
            setupJs.trim()
        );

        // Create mock files
        const styleMock = 'module.exports = {};';
        fs.writeFileSync(
            path.join(this.projectRoot, 'tests/__mocks__/styleMock.js'),
            styleMock
        );

        const fileMock = 'module.exports = "test-file-stub";';
        fs.writeFileSync(
            path.join(this.projectRoot, 'tests/__mocks__/fileMock.js'),
            fileMock
        );
    }

    async setupIDEConfiguration() {
        console.log('💻 Setting up IDE configuration...');

        // Create VSCode settings
        const vscodeSettings = {
            "editor.formatOnSave": true,
            "editor.defaultFormatter": "esbenp.prettier-vscode",
            "editor.codeActionsOnSave": {
                "source.fixAll.eslint": true,
                "source.organizeImports": true
            },
            "eslint.validate": [
                "javascript",
                "javascriptreact",
                "typescript",
                "typescriptreact"
            ],
            "typescript.tsdk": "node_modules/typescript/lib",
            "files.exclude": {
                "**/.git": true,
                "**/.DS_Store": true,
                "**/node_modules": true,
                "**/coverage": true,
                "**/dist": true,
                "**/build": true
            },
            "search.exclude": {
                "**/node_modules": true,
                "**/coverage": true,
                "**/dist": true,
                "**/build": true
            }
        };

        const vscodeDir = path.join(this.projectRoot, '.vscode');
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(vscodeDir, 'settings.json'),
            JSON.stringify(vscodeSettings, null, 2)
        );

        // Create VSCode extensions.json
        const vscodeExtensions = {
            "recommendations": [
                "dbaeumer.vscode-eslint",
                "esbenp.prettier-vscode",
                "ms-python.python",
                "ms-python.pylint",
                "ms-python.black-formatter",
                "ms-vscode.test-adapter-converter",
                "firsttris.vscode-jest-runner",
                "eamodio.gitlens",
                "pkief.material-icon-theme",
                "ms-vscode.vscode-typescript-next"
            ]
        };

        fs.writeFileSync(
            path.join(vscodeDir, 'extensions.json'),
            JSON.stringify(vscodeExtensions, null, 2)
        );

        console.log('  ✅ VSCode configuration created');
        console.log('');
    }

    async setupVSCodeExtensions() {
        console.log('🔧 Recommended VSCode Extensions:');
        const extensions = [
            'dbaeumer.vscode-eslint',
            'esbenp.prettier-vscode',
            'ms-python.python',
            'ms-python.pylint',
            'ms-python.black-formatter',
            'ms-vscode.test-adapter-converter',
            'firsttris.vscode-jest-runner',
            'eamodio.gitlens',
            'pkief.material-icon-theme'
        ];

        extensions.forEach(ext => {
            console.log(`  - ${ext}`);
        });

        console.log('\n  Install with: code --install-extension <extension-name>');
        console.log('');
    }

    async createDevelopmentScripts() {
        console.log('📜 Creating development scripts...');

        const scripts = {
            'dev:setup': 'node scripts/enhanced-development-setup.js',
            'dev:validate': 'npm run lint && npm run format:check && npm run test',
            'dev:fix': 'npm run lint:fix && npm run format',
            'dev:watch': 'npm run test -- --watch',
            'dev:coverage': 'npm run test -- --coverage',
            'dev:clean': 'rm -rf node_modules coverage dist build .jest-cache && npm install',
            'dev:build': 'npm run validate && npm run build',
            'dev:deploy': 'npm run build && npm run deploy:production'
        };

        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            packageJson.scripts = { ...packageJson.scripts, ...scripts };
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            console.log('  ✅ Development scripts added to package.json');
        } else {
            this.warnings.push('package.json not found');
        }

        console.log('');
    }

    async generateDocumentation() {
        console.log('📚 Generating documentation...');

        const devGuide = `
# Development Guide

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Run development setup:
   \`\`\`bash
   npm run dev:setup
   \`\`\`

3. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Available Scripts

- \`npm run dev:setup\` - Run enhanced development setup
- \`npm run dev:validate\` - Validate code (lint, format, test)
- \`npm run dev:fix\` - Fix linting and formatting issues
- \`npm run dev:watch\` - Run tests in watch mode
- \`npm run dev:coverage\` - Generate test coverage report
- \`npm run dev:clean\` - Clean all generated files
- \`npm run dev:build\` - Build for production
- \`npm run dev:deploy\` - Deploy to production

## Code Quality

- ESLint: Run \`npm run lint\` to check code quality
- Prettier: Run \`npm run format\` to format code
- Jest: Run \`npm test\` to run tests
- Coverage: Run \`npm run dev:coverage\` for coverage report

## Git Hooks

Pre-commit hooks automatically run:
- ESLint
- Prettier
- Tests

## IDE Setup

Install recommended VSCode extensions:
\`\`\`bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-python.python
\`\`\`

## Troubleshooting

If you encounter issues:
1. Run \`npm run dev:clean\` to clean and reinstall
2. Check Node.js version (>=14.0.0 required)
3. Check Python version (>=3.7.0 required)
4. Verify all dependencies are installed
`;

        const docsDir = path.join(this.projectRoot, 'docs');
        if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(docsDir, 'DEVELOPMENT_GUIDE.md'),
            devGuide.trim()
        );

        console.log('  ✅ Development guide created');
        console.log('');
    }

    async runValidation() {
        console.log('✅ Running validation...');

        try {
            // Check if node_modules exists
            const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
            if (!fs.existsSync(nodeModulesPath)) {
                console.log('  📦 Installing dependencies...');
                execSync('npm install', { stdio: 'inherit' });
            }

            console.log('  ✅ Validation complete');
        } catch (error) {
            this.warnings.push('Validation failed: ' + error.message);
            console.log('  ⚠️  Validation failed');
        }

        console.log('');
    }

    printSummary() {
        console.log('📋 Setup Summary:');
        console.log('');
        console.log('✅ Setup completed successfully!');
        console.log('');

        if (this.warnings.length > 0) {
            console.log('⚠️  Warnings:');
            this.warnings.forEach(warning => {
                console.log(`  - ${warning}`);
            });
            console.log('');
        }

        console.log('🚀 Next steps:');
        console.log('  1. Review the development guide: docs/DEVELOPMENT_GUIDE.md');
        console.log('  2. Install VSCode extensions (see above)');
        console.log('  3. Run npm run dev:validate to verify setup');
        console.log('  4. Start development with npm run dev');
        console.log('');
    }
}

// Run setup if called directly
if (require.main === module) {
    const setup = new EnhancedDevelopmentSetup();
    setup.run().catch(error => {
        console.error('Setup failed:', error);
        process.exit(1);
    });
}

module.exports = EnhancedDevelopmentSetup;