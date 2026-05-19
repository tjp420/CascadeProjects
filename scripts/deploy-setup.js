#!/usr/bin/env node

/**
 * Deployment Setup Script
 * 
 * This script helps prepare your project for Vercel deployment
 * by checking configuration and providing setup guidance.
 */

const fs = require('fs');
const path = require('path');

class DeploymentSetup {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.checks = [];
    }

    async run() {
        console.log('🚀 Deployment Setup for AI Coding Intelligence Dashboard\n');
        
        this.checkProjectStructure();
        this.checkConfigurationFiles();
        this.checkEnvironmentSetup();
        this.checkAuth0Integration();
        this.generateDeploymentReport();
    }

    checkProjectStructure() {
        console.log('📁 Checking Project Structure...');
        
        const requiredFiles = [
            'web/index.html',
            'vercel.json',
            '.vercelignore',
            'package.json'
        ];

        requiredFiles.forEach(file => {
            const filePath = path.join(this.projectRoot, file);
            const exists = fs.existsSync(filePath);
            this.checks.push({
                check: `Project structure: ${file}`,
                status: exists ? '✅' : '❌',
                details: exists ? 'Found' : 'Missing'
            });
        });

        console.log('');
    }

    checkConfigurationFiles() {
        console.log('⚙️  Checking Configuration Files...');
        
        const configFiles = [
            { path: '.env.production.template', description: 'Environment variables template' },
            { path: 'web/auth0-integration.js', description: 'Auth0 integration' },
            { path: 'DEPLOYMENT_GUIDE.md', description: 'Deployment documentation' }
        ];

        configFiles.forEach(({ path: filePath, description }) => {
            const fullPath = path.join(this.projectRoot, filePath);
            const exists = fs.existsSync(fullPath);
            this.checks.push({
                check: `Configuration: ${description}`,
                status: exists ? '✅' : '❌',
                details: exists ? 'Found' : 'Missing'
            });
        });

        console.log('');
    }

    checkEnvironmentSetup() {
        console.log('🔧 Checking Environment Setup...');
        
        // Check if .env.production exists
        const envFile = path.join(this.projectRoot, '.env.production');
        const envExists = fs.existsSync(envFile);
        
        this.checks.push({
            check: 'Production environment file',
            status: envExists ? '✅' : '⚠️ ',
            details: envExists ? 'Configured' : 'Use .env.production.template'
        });

        // Check if git repository
        const gitDir = path.join(this.projectRoot, '.git');
        const gitExists = fs.existsSync(gitDir);
        
        this.checks.push({
            check: 'Git repository',
            status: gitExists ? '✅' : '❌',
            details: gitExists ? 'Initialized' : 'Run: git init'
        });

        console.log('');
    }

    checkAuth0Integration() {
        console.log('🔐 Checking Auth0 Integration...');
        
        const auth0File = path.join(this.projectRoot, 'web/auth0-integration.js');
        const auth0Exists = fs.existsSync(auth0File);
        
        this.checks.push({
            check: 'Auth0 integration file',
            status: auth0Exists ? '✅' : '❌',
            details: auth0Exists ? 'Ready' : 'Missing'
        });

        // Check if Auth0 is referenced in index.html
        const indexFile = path.join(this.projectRoot, 'web/index.html');
        if (fs.existsSync(indexFile)) {
            const indexContent = fs.readFileSync(indexFile, 'utf8');
            const hasAuth0 = indexContent.includes('auth0-integration.js');
            
            this.checks.push({
                check: 'Auth0 in index.html',
                status: hasAuth0 ? '✅' : '⚠️ ',
                details: hasAuth0 ? 'Integrated' : 'Add script tag'
            });
        }

        console.log('');
    }

    generateDeploymentReport() {
        console.log('📋 Deployment Readiness Report\n');
        console.log('─'.repeat(50));

        let passCount = 0;
        let warnCount = 0;
        let failCount = 0;

        this.checks.forEach(({ check, status, details }) => {
            if (status === '✅') passCount++;
            else if (status === '⚠️ ') warnCount++;
            else failCount++;

            console.log(`${status} ${check}`);
            console.log(`   ${details}`);
        });

        console.log('─'.repeat(50));
        console.log(`\nSummary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed\n`);

        if (failCount === 0 && warnCount <= 2) {
            console.log('🎉 Your project is ready for Vercel deployment!\n');
            this.printNextSteps();
        } else {
            console.log('⚠️  Please address the issues above before deploying.\n');
            this.printTroubleshooting();
        }
    }

    printNextSteps() {
        console.log('📝 Next Steps:\n');
        console.log('1. Create Vercel Account:');
        console.log('   - Go to https://vercel.com');
        console.log('   - Sign up with GitHub\n');
        
        console.log('2. Import Your Project:');
        console.log('   - Click "Add New Project"');
        console.log('   - Select your GitHub repository');
        console.log('   - Use settings from DEPLOYMENT_GUIDE.md\n');
        
        console.log('3. Configure Auth0:');
        console.log('   - Create account at https://auth0.com');
        console.log('   - Follow steps in DEPLOYMENT_GUIDE.md\n');
        
        console.log('4. Deploy:');
        console.log('   - Click "Deploy" in Vercel');
        console.log('   - Wait for deployment to complete');
        console.log('   - Visit your new Vercel URL\n');
        
        console.log('📚 For detailed instructions, see DEPLOYMENT_GUIDE.md\n');
    }

    printTroubleshooting() {
        console.log('🔧 Troubleshooting:\n');
        console.log('Missing Configuration Files:');
        console.log('   - Run: node scripts/deploy-setup.js (this script)');
        console.log('   - Check that all required files exist\n');
        
        console.log('Git Repository Issues:');
        console.log('   - Run: git init');
        console.log('   - Run: git add .');
        console.log('   - Run: git commit -m "Initial commit"\n');
        
        console.log('Auth0 Integration:');
        console.log('   - Ensure web/auth0-integration.js exists');
        console.log('   - Add script tag to web/index.html');
        console.log('   - See DEPLOYMENT_GUIDE.md for details\n');
    }
}

// Main execution
const setup = new DeploymentSetup(process.cwd());
setup.run();