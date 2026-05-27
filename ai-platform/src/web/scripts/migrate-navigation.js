#!/usr/bin/env node

/**
 * Navigation Migration Script
 * This script helps migrate existing HTML files to use the centralized navigation system
 */

const fs = require('fs');
const path = require('path');

class NavigationMigrator {
    constructor() {
        this.webDir = path.join(__dirname, '..');
        this.htmlFiles = [];
        this.processedFiles = [];
        this.errors = [];
    }

    async migrate() {
        console.log('🚀 Starting navigation migration...\n');
        
        // Find all HTML files
        await this.findHtmlFiles();
        
        if (this.htmlFiles.length === 0) {
            console.log('❌ No HTML files found to migrate');
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
            
            // Check if it already uses centralized navigation
            if (content.includes('navigation-container')) {
                console.log('   ✅ Already uses centralized navigation');
                return;
            }
            
            // Extract the main content (remove existing navigation)
            const processedContent = this.extractMainContent(content);
            
            // Create the new HTML structure
            const newContent = this.createNewStructure(processedContent, path.basename(filePath));
            
            // Create backup
            const backupPath = filePath + '.backup';
            await fs.promises.copyFile(filePath, backupPath);
            
            // Write the new content
            await fs.promises.writeFile(filePath, newContent);
            
            this.processedFiles.push(filePath);
            console.log('   ✅ Migration completed');
            
        } catch (error) {
            console.error(`   ❌ Error processing ${path.basename(filePath)}:`, error.message);
            this.errors.push({ file: filePath, error: error.message });
        }
    }

    extractMainContent(content) {
        // Remove the navigation section
        let processedContent = content;
        
        // Remove common navigation patterns
        const navPatterns = [
            /<nav[^>]*>[\s\S]*?<\/nav>/gi,
            /<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
            /<div[^>]*class="[^"]*navigation[^"]*"[^>]*>[\s\S]*?<\/div>/gi
        ];
        
        for (const pattern of navPatterns) {
            processedContent = processedContent.replace(pattern, '');
        }
        
        return processedContent;
    }

    createNewStructure(mainContent, fileName) {
        const title = this.extractTitle(mainContent, fileName);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Cascade AI Platform</title>
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Custom Styles -->
    <style>
        :root {
            --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            --success-gradient: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
            --warning-gradient: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            --info-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-card: #334155;
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --border-color: #475569;
            --accent-color: #6366f1;
            --accent-hover: #818cf8;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* Modern Sidebar Styles */
        .sidebar-modern {
            position: fixed;
            left: 0;
            top: 0;
            width: 280px;
            height: 100vh;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border-color);
            z-index: 1000;
            transition: transform 0.3s ease;
            overflow-y: auto;
        }

        .sidebar-modern.collapsed {
            transform: translateX(-240px);
        }

        .sidebar-header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-color);
        }

        .logo-container {
            text-align: center;
        }

        .logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
        }

        .logo i {
            color: var(--accent-color);
            font-size: 2rem;
        }

        .logo-subtitle {
            font-size: 0.875rem;
            color: var(--text-secondary);
        }

        .nav-container {
            padding: 1rem 0;
        }

        .nav-section-modern {
            margin-bottom: 2rem;
        }

        .nav-title-modern {
            padding: 0.5rem 1.5rem;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .nav-item-modern {
            margin: 0.25rem 0;
        }

        .nav-link-modern {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1.5rem;
            color: var(--text-secondary);
            text-decoration: none;
            transition: all 0.2s ease;
            border-left: 3px solid transparent;
        }

        .nav-link-modern:hover {
            background: var(--bg-card);
            color: var(--text-primary);
        }

        .nav-link-modern.active {
            background: var(--bg-card);
            color: var(--accent-color);
            border-left-color: var(--accent-color);
        }

        .nav-icon-modern {
            width: 20px;
            text-align: center;
        }

        .sidebar-footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 1rem;
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .sidebar-toggle {
            padding: 0.5rem;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 0.375rem;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .sidebar-toggle:hover {
            background: var(--accent-color);
            color: white;
        }

        .sidebar-info {
            font-size: 0.75rem;
            color: var(--text-secondary);
        }

        /* Main Content */
        .main-content-with-sidebar {
            margin-left: 280px;
            min-height: 100vh;
            transition: margin-left 0.3s ease;
        }

        .sidebar-modern.collapsed ~ .main-content-with-sidebar {
            margin-left: 40px;
        }

        .page-header {
            padding: 2rem;
            border-bottom: 1px solid var(--border-color);
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .page-title {
            font-size: 2rem;
            font-weight: 700;
            color: var(--text-primary);
        }

        .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn-primary {
            background: var(--accent-color);
            color: white;
        }

        .btn-primary:hover {
            background: var(--accent-hover);
        }

        .page-content {
            padding: 2rem;
        }

        .content-wrapper {
            max-width: 1200px;
            margin: 0 auto;
        }

        .content-section {
            margin-bottom: 2rem;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
            .sidebar-modern {
                transform: translateX(-240px);
            }
            
            .sidebar-modern.collapsed {
                transform: translateX(0);
            }
            
            .main-content-with-sidebar {
                margin-left: 0;
            }
            
            .sidebar-modern.collapsed ~ .main-content-with-sidebar {
                margin-left: 280px;
            }
        }

        /* Preserve existing styles from original file */
        ${this.extractExistingStyles(mainContent)}
    </style>
</head>
<body>
    <!-- Navigation Container - This will be populated by navigation-loader.js -->
    <div class="navigation-container"></div>

    <!-- Main Content Area -->
    <div class="main-content-with-sidebar">
        ${this.extractMainContentOnly(mainContent)}
    </div>

    <!-- JavaScript -->
    <script src="/js/navigation-loader.js"></script>
    ${this.extractExistingScripts(mainContent)}
</body>
</html>`;
    }

    extractTitle(content, fileName) {
        // Try to extract title from the original content
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            return titleMatch[1].replace(/\s*-\s*.*$/, '');
        }
        
        // Fallback to filename
        return fileName.replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    extractExistingStyles(content) {
        // Extract existing styles from the original file
        const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch) {
            return styleMatch[1];
        }
        return '';
    }

    extractMainContentOnly(content) {
        // Extract only the main content (inside body, excluding navigation)
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            let bodyContent = bodyMatch[1];
            
            // Remove navigation elements
            const navPatterns = [
                /<nav[^>]*>[\s\S]*?<\/nav>/gi,
                /<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
                /<div[^>]*class="[^"]*navigation[^"]*"[^>]*>[\s\S]*?<\/div>/gi
            ];
            
            for (const pattern of navPatterns) {
                bodyContent = bodyContent.replace(pattern, '');
            }
            
            return bodyContent;
        }
        
        return '<div class="content-wrapper"><p>Content migrated from original file</p></div>';
    }

    extractExistingScripts(content) {
        // Extract existing scripts from the original file
        const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches) {
            return scriptMatches.join('\n');
        }
        return '';
    }

    generateReport() {
        console.log('\n📊 Migration Report');
        console.log('==================');
        console.log(`✅ Successfully processed: ${this.processedFiles.length} files`);
        console.log(`❌ Errors: ${this.errors.length} files`);
        
        if (this.processedFiles.length > 0) {
            console.log('\n📁 Processed files:');
            this.processedFiles.forEach(file => {
                console.log(`   ✅ ${path.basename(file)}`);
            });
        }
        
        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(error => {
                console.log(`   ❌ ${path.basename(error.file)}: ${error.error}`);
            });
        }
        
        console.log('\n🎉 Migration completed!');
        console.log('\n📝 Next steps:');
        console.log('1. Test the migrated pages to ensure they work correctly');
        console.log('2. Remove navigation-container divs from any remaining files');
        console.log('3. Update the server to serve the new navigation component');
        console.log('4. Consider removing the backup files (.backup) once confirmed working');
    }
}

// Run the migration
if (require.main === module) {
    const migrator = new NavigationMigrator();
    migrator.migrate().catch(console.error);
}

module.exports = NavigationMigrator;
