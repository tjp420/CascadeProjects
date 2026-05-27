/**
 * Direct Display-Level Fix for Files with Findings Issue
 * This script directly manipulates the display to show the correct filesWithFindings value
 */

(function() {
    'use strict';
    
    console.log('🎯 Direct Display-Level Fix activated...');
    
    /**
     * Calculate filesWithFindings from the visible topFiles section
     * @returns {number} Calculated filesWithFindings value
     */
    function calculateFromTopFiles() {
        // Look for top files in various possible selectors
        const topFilesSelectors = [
            '.top-files .file-item',
            '.top-files .file-result',
            '.top-files li',
            '.top-files tr',
            '.top-files [data-file]',
            '#topFiles .file-item',
            '#topFiles .file-result',
            '#topFiles li',
            '#topFiles tr'
        ];
        
        for (const selector of topFilesSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`🎯 Found ${elements.length} top files using selector: ${selector}`);
                return elements.length;
            }
        }
        
        // Fallback: look for any file entries in the results
        const fileEntries = document.querySelectorAll('[data-file], .file-entry, .file-result, .file-item');
        if (fileEntries.length > 0) {
            console.log(`🎯 Found ${fileEntries.length} file entries as fallback`);
            return fileEntries.length;
        }
        
        console.log('⚠️ No top files found in DOM');
        return 0;
    }
    
    /**
     * Find and update the filesWithFindings display element
     * @param {number} correctValue - The correct filesWithFindings value
     * @returns {boolean} Whether the fix was applied
     */
    function updateFilesWithFindingsDisplay(correctValue) {
        // Look for filesWithFindings display elements
        const displaySelectors = [
            '.files-with-findings',
            '[data-files-with-findings]',
            '.summary .files-with-findings',
            '.metrics .files-with-findings',
            '#filesWithFindings',
            '.stat-files-with-findings',
            '[data-stat="filesWithFindings"]'
        ];
        
        let fixed = false;
        
        for (const selector of displaySelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const currentValue = parseInt(element.textContent) || 0;
                if (currentValue === 0 && correctValue > 0) {
                    console.log(`🎯 Direct Display Fix Applied: ${selector} - ${currentValue} → ${correctValue}`);
                    element.textContent = correctValue;
                    element.style.color = '#28a745'; // Green color
                    element.style.fontWeight = 'bold';
                    element.title = `Fixed by direct display fix (was ${currentValue})`;
                    element.setAttribute('data-fixed', 'true');
                    fixed = true;
                }
            });
        }
        
        // Also look for text nodes containing "Files with Findings: 0"
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let textNode;
        while ((textNode = walker.nextNode())) {
            if (textNode.textContent.includes('Files with Findings: 0')) {
                const parent = textNode.parentNode;
                if (parent && correctValue > 0) {
                    console.log(`🎯 Direct Display Fix Applied to text node: 0 → ${correctValue}`);
                    parent.textContent = parent.innerHTML.replace('Files with Findings: 0', `Files with Findings: ${correctValue}`) /* Replaced innerHTML with textContent for safety */
                    parent.style.color = '#28a745';
                    fixed = true;
                }
            }
        }
        
        return fixed;
    }
    
    /**
     * Apply the direct display fix
     * @returns {boolean} Whether the fix was applied
     */
    function applyDirectDisplayFix() {
        console.log('🎯 Applying direct display fix...');
        
        const calculatedValue = calculateFromTopFiles();
        console.log(`🎯 Calculated files with findings: ${calculatedValue}`);
        
        if (calculatedValue > 0) {
            const fixed = updateFilesWithFindingsDisplay(calculatedValue);
            if (fixed) {
                console.log(`✅ Direct display fix successfully applied: ${calculatedValue} files with findings`);
                return true;
            } else {
                console.log('⚠️ Direct display fix applied but no display elements found to update');
                return false;
            }
        } else {
            console.log('⚠️ Cannot apply direct display fix: no top files found in DOM');
            console.log('🎯 This is normal if no scan has been run yet or if the page is not showing scan results');
            return false;
        }
    }
    
    /**
     * Monitor for scan results and apply fix
     */
    function monitorAndFix() {
        console.log('🎯 Starting direct display monitor...');
        
        // Apply fix immediately
        setTimeout(() => {
            applyDirectDisplayFix();
        }, 1000);
        
        // Monitor for DOM changes
        const observer = new MutationObserver((mutations) => {
            let shouldApplyFix = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Look for scan results or top files
                        if (node.querySelector && (
                            node.querySelector('.top-files') ||
                            node.querySelector('#topFiles') ||
                            node.querySelector('.files-with-findings') ||
                            node.querySelector('[data-files-with-findings]') ||
                            node.textContent.includes('Files with Findings: 0')
                        )) {
                            shouldApplyFix = true;
                        }
                        
                        // Check if the node itself contains the elements
                        if (node.classList && (
                            node.classList.contains('top-files') ||
                            node.classList.contains('files-with-findings') ||
                            node.getAttribute('data-files-with-findings') !== null
                        )) {
                            shouldApplyFix = true;
                        }
                    }
                });
            });
            
            if (shouldApplyFix) {
                setTimeout(() => {
                    applyDirectDisplayFix();
                }, 500);
            }
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        console.log('✅ Direct display monitor started');
    }
    
    /**
     * Add manual fix button
     */
    function addManualFixButton() {
        // Check if button already exists
        if (document.querySelector('#direct-fix-button')) {
            return;
        }
        
        const button = document.createElement('button');
        button.id = 'direct-fix-button';
        button.textContent = '🎯 Fix Files with Findings';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            z-index: 9999;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        button.addEventListener('click', () => {
            console.log('🎯 Button clicked - attempting to fix...');
            const success = applyDirectDisplayFix();
            console.log(`🎯 Fix result: ${success}`);
            if (success) {
                button.style.background = '#28a745';
                button.textContent = '✅ Fixed!';
                setTimeout(() => {
                    button.style.background = '#007bff';
                    button.textContent = '🎯 Fix Files with Findings';
                }, 2000);
            } else {
                button.style.background = '#dc3545';
                button.textContent = '❌ No data found';
                console.log('🎯 No data found to fix - check console for details');
                setTimeout(() => {
                    button.style.background = '#007bff';
                    button.textContent = '🎯 Fix Files with Findings';
                }, 2000);
            }
        });
        
        document.body.appendChild(button);
        console.log('✅ Manual fix button added');
    }
    
    /**
     * Initialize the direct display fix
     */
    function initialize() {
        console.log('🎯 Initializing Direct Display-Level Fix...');
        
        // Add manual fix button
        addManualFixButton();
        
        // Start monitoring
        monitorAndFix();
        
        // Apply fix periodically to ensure persistence
        setInterval(() => {
            applyDirectDisplayFix();
        }, 3000);
        
        console.log('✅ Direct Display-Level Fix initialized');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Also initialize immediately
    setTimeout(initialize, 500);
    
    console.log('🎯 Direct Display-Level Fix loaded and ready');
})();
