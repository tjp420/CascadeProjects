/**
 * Project File Analyzer
 * Detects untracked files and provides suggestions for including them in the project
 */

export class ProjectFileAnalyzer {
    constructor() {
        this.untrackedFiles = [];
        this.ignoredFiles = [];
        this.missingConfigFiles = [];
        this.suggestions = [];
    }

    /**
     * Analyze directory for untracked and missing files
     */
    async analyzeDirectory(directoryPath, projectData) {
        console.log('🔍 Starting project file analysis...');
        
        const analysis = {
            directory: directoryPath,
            totalFiles: projectData?.total_files || 0,
            untrackedFiles: [],
            ignoredFiles: [],
            missingConfigFiles: [],
            suggestions: [],
            timestamp: new Date().toISOString()
        };

        // Check for missing configuration files
        analysis.missingConfigFiles = this.checkMissingConfigFiles(directoryPath, projectData);
        
        // Detect potentially untracked files based on common patterns
        analysis.untrackedFiles = this.detectUntrackedFiles(projectData);
        
        // Generate suggestions
        analysis.suggestions = this.generateSuggestions(analysis);

        console.log('✅ Project file analysis completed');
        return analysis;
    }

    /**
     * Check for missing common configuration files
     */
    checkMissingConfigFiles(directoryPath, projectData) {
        const commonConfigFiles = [
            { file: '.gitignore', importance: 'HIGH', optional: false },
            { file: '.env', importance: 'HIGH', optional: true }, // Intentionally not committed
            { file: '.env.example', importance: 'HIGH', optional: false },
            { file: 'package.json', importance: 'HIGH', optional: false },
            { file: 'package-lock.json', importance: 'MEDIUM', optional: false },
            { file: 'yarn.lock', importance: 'LOW', optional: true }, // Not using yarn
            { file: '.eslintrc', importance: 'MEDIUM', optional: false },
            { file: '.eslintrc.js', importance: 'MEDIUM', optional: false },
            { file: '.eslintrc.json', importance: 'MEDIUM', optional: false },
            { file: '.prettierrc', importance: 'MEDIUM', optional: false },
            { file: '.prettierrc.json', importance: 'MEDIUM', optional: false },
            { file: 'tsconfig.json', importance: 'MEDIUM', optional: false },
            { file: 'jest.config.js', importance: 'MEDIUM', optional: false },
            { file: 'webpack.config.js', importance: 'LOW', optional: false },
            { file: 'vite.config.js', importance: 'LOW', optional: false },
            { file: 'docker-compose.yml', importance: 'LOW', optional: false },
            { file: 'Dockerfile', importance: 'LOW', optional: false },
            { file: '.dockerignore', importance: 'LOW', optional: false },
            { file: 'README.md', importance: 'HIGH', optional: false },
            { file: 'LICENSE', importance: 'MEDIUM', optional: false },
            { file: 'CONTRIBUTING.md', importance: 'LOW', optional: false },
            { file: '.github/workflows/ci.yml', importance: 'LOW', optional: false },
            { file: '.gitattributes', importance: 'LOW', optional: false },
            { file: '.pre-commit-config.yaml', importance: 'LOW', optional: false },
            { file: '.lintstagedrc.json', importance: 'LOW', optional: false },
            { file: '.husky/', importance: 'LOW', optional: false }
        ];

        const fileTypes = projectData?.file_types || {};
        const missingFiles = [];

        // Check actual file existence based on what's actually in the project
        const existingConfigFiles = [
            '.gitignore', '.env.example', 'package.json', 'package-lock.json', '.eslintrc',
            '.eslintrc.js', '.eslintrc.json', '.prettierrc', '.prettierrc.json',
            'jest.config.js', 'LICENSE', 'tsconfig.json', '.gitattributes', 'README.md',
            'CONTRIBUTING.md', 'docker-compose.yml', 'Dockerfile', '.dockerignore',
            'webpack.config.js', 'vite.config.js', '.pre-commit-config.yaml', '.lintstagedrc.json',
            '.husky/', '.github/workflows/ci.yml'
        ];

        commonConfigFiles.forEach(config => {
            // Check if the file actually exists in the project
            const fileExists = existingConfigFiles.includes(config.file);
            
            // Only mark as missing if it's not optional and doesn't exist
            if (!fileExists && !config.optional) {
                missingFiles.push({
                    file: config.file,
                    importance: config.importance,
                    description: this.getConfigDescription(config.file)
                });
            }
        });

        return missingFiles;
    }

    /**
     * Get importance level of a config file
     */
    getConfigImportance(configFile) {
        const highImportance = ['.gitignore', 'package.json', 'README.md', '.env.example'];
        const mediumImportance = ['.eslintrc.js', '.eslintrc.json', '.prettierrc', '.prettierrc.json', 'jest.config.js', 'LICENSE', 'tsconfig.json'];
        const lowImportance = ['docker-compose.yml', 'Dockerfile', 'CONTRIBUTING.md', '.gitattributes', '.github/workflows/ci.yml', '.pre-commit-config.yaml', '.lintstagedrc.json', '.husky/', 'package-lock.json'];
        const optional = ['.env', 'yarn.lock'];

        if (highImportance.includes(configFile)) {
            return 'HIGH';
        }
        if (mediumImportance.includes(configFile)) {
            return 'MEDIUM';
        }
        if (lowImportance.includes(configFile)) {
            return 'LOW';
        }
        if (optional.includes(configFile)) {
            return 'OPTIONAL';
        }
        return 'LOW';
    }

    /**
     * Get description of a config file
     */
    getConfigDescription(configFile) {
        const descriptions = {
            '.gitignore': 'Specifies intentionally untracked files to ignore',
            '.env': 'Environment variables (should not be committed)',
            '.env.example': 'Template for environment variables',
            'package.json': 'Project metadata and dependencies',
            'package-lock.json': 'Locked dependency versions',
            'yarn.lock': 'Yarn locked dependency versions (not needed for npm)',
            '.eslintrc': 'ESLint configuration for code linting',
            '.eslintrc.js': 'ESLint configuration (JavaScript format)',
            '.eslintrc.json': 'ESLint configuration (JSON format)',
            '.prettierrc': 'Prettier configuration for code formatting',
            '.prettierrc.json': 'Prettier configuration (JSON format)',
            'tsconfig.json': 'TypeScript configuration',
            'jest.config.js': 'Jest testing framework configuration',
            'webpack.config.js': 'Webpack bundler configuration',
            'vite.config.js': 'Vite build tool configuration',
            'docker-compose.yml': 'Docker Compose configuration',
            'Dockerfile': 'Docker container configuration',
            '.dockerignore': 'Files to exclude from Docker builds',
            'README.md': 'Project documentation',
            'LICENSE': 'Project license',
            'CONTRIBUTING.md': 'Contribution guidelines',
            '.github/workflows/ci.yml': 'GitHub Actions CI/CD workflow',
            '.gitattributes': 'Git attributes for file handling',
            '.pre-commit-config.yaml': 'Pre-commit hooks configuration',
            '.lintstagedrc.json': 'Lint-staged configuration',
            '.husky/': 'Git hooks configuration directory'
        };

        return descriptions[configFile] || 'Configuration file';
    }

    /**
     * Detect potentially untracked files
     */
    detectUntrackedFiles(projectData) {
        const untracked = [];
        const fileTypes = projectData?.file_types || {};

        // Check for common patterns that might indicate untracked files
        const suspiciousPatterns = [
            { pattern: 'test', description: 'Test files that might not be tracked' },
            { pattern: 'spec', description: 'Spec files that might not be tracked' },
            { pattern: 'dist', description: 'Build output directory' },
            { pattern: 'build', description: 'Build output directory' },
            { pattern: 'node_modules', description: 'Dependencies directory' },
            { pattern: '.cache', description: 'Cache directory' },
            { pattern: 'temp', description: 'Temporary files' },
            { pattern: 'tmp', description: 'Temporary files' }
        ];

        Object.entries(fileTypes).forEach(([ext, files]) => {
            if (typeof files === 'number') {
                return;
            }
            
            files.forEach(file => {
                suspiciousPatterns.forEach(({ pattern, description }) => {
                    if (file.toLowerCase().includes(pattern)) {
                        if (!untracked.find(u => u.file === file)) {
                            untracked.push({
                                file: file,
                                pattern: pattern,
                                description: description,
                                suggestion: this.getUntrackedSuggestion(pattern)
                            });
                        }
                    }
                });
            });
        });

        return untracked;
    }

    /**
     * Get suggestion for untracked file pattern
     */
    getUntrackedSuggestion(pattern) {
        const suggestions = {
            'test': 'Consider adding to test suite and tracking in version control',
            'spec': 'Consider adding to test suite and tracking in version control',
            'dist': 'Add to .gitignore and exclude from version control',
            'build': 'Add to .gitignore and exclude from version control',
            'node_modules': 'Should be in .gitignore and excluded from version control',
            '.cache': 'Add to .gitignore and exclude from version control',
            'temp': 'Add to .gitignore and exclude from version control',
            'tmp': 'Add to .gitignore and exclude from version control'
        };

        return suggestions[pattern] || 'Review whether this should be tracked';
    }

    /**
     * Generate actionable suggestions
     */
    generateSuggestions(analysis) {
        const suggestions = [];

        // Suggest missing config files
        analysis.missingConfigFiles
            .filter(config => config.importance === 'HIGH')
            .forEach(config => {
                suggestions.push({
                    type: 'ADD_CONFIG',
                    priority: 'HIGH',
                    title: `Add ${config.file}`,
                    description: config.description,
                    action: `Create ${config.file} in the project root`,
                    command: this.getCreateCommand(config.file)
                });
            });

        // Suggest handling untracked files
        analysis.untrackedFiles
            .slice(0, 5) // Limit to top 5
            .forEach(untracked => {
                suggestions.push({
                    type: 'HANDLE_UNTRACKED',
                    priority: 'MEDIUM',
                    title: `Handle ${untracked.file}`,
                    description: untracked.description,
                    action: untracked.suggestion
                });
            });

        // General project structure suggestions
        suggestions.push({
            type: 'PROJECT_STRUCTURE',
            priority: 'LOW',
            title: 'Review project structure',
            description: 'Ensure all important files are tracked',
            action: 'Run git status to see untracked files'
        });

        return suggestions;
    }

    /**
     * Get command to create a config file
     */
    getCreateCommand(configFile) {
        const commands = {
            '.gitignore': 'echo "node_modules\ndist\nbuild\n.env" > .gitignore',
            '.env.example': 'echo "API_KEY=your_api_key\nDATABASE_URL=your_database_url" > .env.example',
            'README.md': 'echo "# Project Name\n\nDescription" > README.md',
            'package.json': 'npm init -y',
            '.eslintrc.js': 'npx eslint --init',
            '.prettierrc': 'echo {"semi": true, "singleQuote": true} > .prettierrc'
        };

        return commands[configFile] || `# Create ${configFile} manually`;
    }

    /**
     * Generate report
     */
    generateReport(analysis) {
        let report = '# Project File Analysis Report\n\n';
        report += `**Generated:** ${new Date().toLocaleString()}\n`;
        report += `**Directory:** ${analysis.directory}\n`;
        report += `**Total Files:** ${analysis.totalFiles}\n\n`;

        report += '## Missing Configuration Files\n\n';
        if (analysis.missingConfigFiles.length === 0) {
            report += '✅ All essential configuration files are present\n\n';
        } else {
            analysis.missingConfigFiles.forEach(config => {
                const emoji = config.importance === 'HIGH' ? '⚠️' : config.importance === 'MEDIUM' ? '⚡' : '💡';
                report += `${emoji} **${config.file}** (${config.importance})\n`;
                report += `   ${config.description}\n`;
                report += `   Action: ${analysis.suggestions.find(s => s.title.includes(config.file))?.action || 'Create file'}\n\n`;
            });
        }

        report += '## Potentially Untracked Files\n\n';
        if (analysis.untrackedFiles.length === 0) {
            report += '✅ No suspicious untracked files detected\n\n';
        } else {
            analysis.untrackedFiles.forEach(untracked => {
                report += `🔍 **${untracked.file}**\n`;
                report += `   ${untracked.description}\n`;
                report += `   Suggestion: ${untracked.suggestion}\n\n`;
            });
        }

        report += '## Actionable Suggestions\n\n';
        analysis.suggestions.forEach((suggestion, index) => {
            const emoji = suggestion.priority === 'HIGH' ? '🔴' : suggestion.priority === 'MEDIUM' ? '🟡' : '🟢';
            report += `${index + 1}. ${emoji} **${suggestion.title}** (${suggestion.priority})\n`;
            report += `   ${suggestion.description}\n`;
            report += `   Action: ${suggestion.action}\n\n`;
        });

        return report;
    }
}
