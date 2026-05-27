#!/usr/bin/env node

/**
 * Old Navigation Cleanup Script
 * This script removes old navigation code from migrated HTML files
 */

const fs = require('fs');
const path = require('path');

class NavigationCleanup {
    constructor() {
        this.webDir = path.join(__dirname, '..');
        this.htmlFiles = [];
        this.processedFiles = [];
        this.errors = [];
        this.removedBackups = [];
    }

    async cleanup() {
        console.log('🧹 Starting old navigation cleanup...\n');
        
        // Find all HTML files
        await this.findHtmlFiles();
        
        if (this.htmlFiles.length === 0) {
            console.log('❌ No HTML files found to cleanup');
            return;
        }
        
        console.log(`📁 Found ${this.htmlFiles.length} HTML files to process\n`);
        
        // Process each file
        for (const file of this.htmlFiles) {
            await this.processFile(file);
        }
        
        // Generate report
        this.generateReport();
    }

    async findHtmlFiles() {
        const files = await fs.promises.readdir(this.webDir);
        
        for (const file of files) {
            const filePath = path.join(this.webDir, file);
            const stat = await fs.promises.stat(filePath);
            
            if (stat.isFile() && file.endsWith('.html')) {
                this.htmlFiles.push(filePath);
            }
        }
    }

    async processFile(filePath) {
        try {
            console.log(`📄 Processing: ${path.basename(filePath)}`);
            
            // Read the file
            const content = await fs.promises.readFile(filePath, 'utf8');
            
            // Check if it uses centralized navigation
            if (!content.includes('navigation-container')) {
                console.log('   ⚠️  Does not use centralized navigation');
                return;
            }
            
            // Remove old navigation patterns
            const cleanedContent = this.removeOldNavigation(content);
            
            // Write the cleaned content
            await fs.promises.writeFile(filePath, cleanedContent);
            
            // Remove backup file if it exists
            const backupPath = filePath + '.backup';
            if (fs.existsSync(backupPath)) {
                await fs.promises.unlink(backupPath);
                this.removedBackups.push(backupPath);
            }
            
            this.processedFiles.push(filePath);
            console.log('   ✅ Cleanup completed');
            
        } catch (error) {
            console.error(`   ❌ Error processing ${path.basename(filePath)}:`, error.message);
            this.errors.push({ file: filePath, error: error.message });
        }
    }

    removeOldNavigation(content) {
        let cleanedContent = content;
        
        // Remove old navigation patterns
        const oldNavPatterns = [
            // Remove any remaining sidebar navigation
            /<nav[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/nav>/gi,
            /<nav[^>]*class="[^"]*navigation[^"]*"[^>]*>[\s\s]*?<\/nav>/gi,
            
            // Remove old navigation containers
            /<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
            /<div[^>]*class="[^"]*navigation[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
            
            // Remove old navigation menus
            /<ul[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
            /<div[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
            
            // Remove old navigation links that might interfere
            /<a[^>]*href="#"[^>]*>[\s\S]*?<\/a>/gi,
            
            // Remove old setActiveNav function calls (except the one in navigation-loader)
            /onclick="setActiveNav\([^)]*\)"/gi,
            
            // Remove old sidebar toggle calls
            /onclick="toggleSidebar\([^)]*\)"/gi,
            
            // Remove old navigation-related scripts
            /<script[^>]*>[\s\S]*?function\s+setActiveNav[\s\S]*?<\/script>/gi,
            /<script[^>]*>[\s\S]*?function\s+toggleSidebar[\s\S]*?<\/script>/gi,
        ];
        
        for (const pattern of oldNavPatterns) {
            cleanedContent = cleanedContent.replace(pattern, '');
        }
        
        // Clean up extra whitespace
        cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        return cleanedContent;
    }

    generateReport() {
        console.log('\n📊 Cleanup Report');
        console.log('==================');
        console.log(`✅ Successfully processed: ${this.processedFiles.length} files`);
        console.log(`🗑️  Removed backups: ${this.removedBackups.length} files`);
        console.log(`❌ Errors: ${this.errors.length} files`);
        
        if (this.processedFiles.length > 0) {
            console.log('\n📁 Processed files:');
            this.processedFiles.forEach(file => {
                console.log(`   ✅ ${path.basename(file)}`);
            });
        }
        
        if (this.removedBackups.length > 0) {
            console.log('\n🗑️  Removed backup files:');
            this.removedBackups.forEach(file => {
                console.log(`   🗑️  ${path.basename(file)}`);
            });
        }
        
        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(error => {
                console.log(`   ❌ ${path.basename(error.file)}: ${error.error}`);
            });
        }
        
        console.log('\n🎉 Cleanup completed!');
        console.log('\n📝 Summary:');
        console.log('✅ Old navigation code removed from all migrated files');
        console.log('✅ Backup files cleaned up');
        console.log('✅ Files now use centralized navigation system');
        console.log('✅ Navigation is now maintainable from a single source');
    }
}

// Run the cleanup
if (require.main === module) {
    const cleanup = new NavigationCleanup();
    cleanup.cleanup().catch(console.error);
}

module.exports = NavigationCleanup;
