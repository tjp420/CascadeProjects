
/**
 * Scanner Error Fix Script
 * Fixes common DOM timing issues in the mock data scanner
 */

const fs = require('fs');
const path = require('path');

class ScannerErrorFixer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.indexHtmlPath = path.join(projectRoot, 'web', 'index.html');
    }

    fix() {
        console.log('🔧 Fixing Scanner Error...\n');

        if (!fs.existsSync(this.indexHtmlPath)) {
            console.log('❌ index.html not found');
            return false;
        }

        const content = fs.readFileSync(this.indexHtmlPath, 'utf8');
        
        // Fix 1: Add proper error handling to downloadMockDataReport
        const fixedContent = this.fixDownloadFunction(content);
        
        // Fix 2: Add DOM readiness checks
        const finalContent = this.addDOMReadinessChecks(fixedContent);
        
        fs.writeFileSync(this.indexHtmlPath, finalContent);
        
        console.log('✅ Scanner error fixed successfully!');
        console.log('\n📋 Changes made:');
        console.log('   - Added error handling to download function');
        console.log('   - Added DOM element existence checks');
        console.log('   - Added content validation before download');
        console.log('   - Added user-friendly error messages');
        
        return true;
    }

    fixDownloadFunction(content) {
        const oldFunction = /function downloadMockDataReport\(isMultiFile = false\) \{[\s\S]*?\n {8}\}/;
        
        const newFunction = `function downloadMockDataReport(isMultiFile = false) {
            try {
                const contentElement = document.getElementById('mock-data-report-content');
                if (!contentElement) {
                    console.error('Mock data report content element not found');
                    alert('Please generate a report first before downloading.');
                    return;
                }
                
                const content = contentElement.innerText || contentElement.textContent;
                if (!content || content.trim() === '') {
                    console.error('Mock data report content is empty');
                    alert('Report content is empty. Please generate a report first.');
                    return;
                }
                
                const filename = isMultiFile ? 'mock-data-report-multi-file.txt' : 'mock-data-report.txt';
                downloadFile(content, filename, 'text/plain');
                console.log('✅ Report downloaded successfully');
            } catch (error) {
                console.error('❌ Error downloading mock data report:', error);
                alert('Error downloading report: ' + error.message);
            }
        }`;

        return content.replace(oldFunction, newFunction);
    }

    addDOMReadinessChecks(content) {
        // Add a helper function to check DOM readiness
        const helperFunction = `
        // Helper function to check if DOM element exists and is ready
        function waitForElement(id, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const element = document.getElementById(id);
                if (element) {
                    resolve(element);
                    return;
                }
                
                const timer = setTimeout(() => {
                    reject(new Error(\`Element \${id} not found within timeout\`));
                }, timeout);
                
                const observer = new MutationObserver(() => {
                    const element = document.getElementById(id);
                    if (element) {
                        clearTimeout(timer);
                        observer.disconnect();
                        resolve(element);
                    }
                });
                
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }
        `;

        // Insert the helper function before the main functions
        const insertPoint = content.indexOf('function displayMockDataReport');
        if (insertPoint > 0) {
            return content.slice(0, insertPoint) + helperFunction + '\n' + content.slice(insertPoint);
        }
        
        return content;
    }
}

// Main execution
const fixer = new ScannerErrorFixer(process.cwd());
fixer.fix();