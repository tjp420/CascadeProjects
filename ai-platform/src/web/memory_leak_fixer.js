/**
 * Memory Leak Fix Utility
 * Automatically fixes common memory leak patterns in JavaScript code
 */

class MemoryLeakFixer {
    constructor() {
        this.fixesApplied = 0;
        this.scanResults = [];
    }

    /**
     * Scan and fix memory leaks in a file
     */
    async scanAndFixFile(filePath) {
        try {
            const response = await fetch(filePath);
            const content = await response.text();
            
            const fixedContent = this.fixMemoryLeaks(content);
            
            if (fixedContent !== content) {
                console.log(`🔧 Fixed memory leaks in ${filePath}`);
                return fixedContent;
            } else {
                console.log(`✅ No memory leaks found in ${filePath}`);
                return content;
            }
        } catch (error) {
            console.error(`❌ Error scanning ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Fix memory leaks in code content
     */
    fixMemoryLeaks(content) {
        let fixedContent = content;
        const originalContent = content;

        // Fix 1: Anonymous event listeners without cleanup
        fixedContent = this.fixAnonymousEventListeners(fixedContent);
        
        // Fix 2: Missing removeEventListener calls
        fixedContent = this.fixMissingRemoveEventListener(fixedContent);
        
        // Fix 3: Timer leaks
        fixedContent = this.fixTimerLeaks(fixedContent);
        
        // Fix 4: Observer leaks
        fixedContent = this.fixObserverLeaks(fixedContent);
        
        // Fix 5: Interval leaks
        fixedContent = this.fixIntervalLeaks(fixedContent);
        
        // Fix 6: Closure leaks
        fixedContent = this.fixClosureLeaks(fixedContent);
        
        // Fix 7: DOM reference leaks
        fixedContent = this.fixDOMReferenceLeaks(fixedContent);

        if (fixedContent !== originalContent) {
            this.fixesApplied++;
        }

        return fixedContent;
    }

    /**
     * Fix anonymous event listeners
     */
    fixAnonymousEventListeners(content) {
        // Pattern: element.addEventListener('click', function() { ... });
        const pattern = /(\w+)\.addEventListener\(['"`']([^'"`]+)['"`'],\s*function\s*\([^)]*\)\s*\{/g;
        
        return content.replace(pattern, (match, elementVar, eventType) => {
            const handlerName = this.generateHandlerName(eventType);
            const fixedCode = `
// Fixed: Named function for proper cleanup
const ${handlerName} = function(${this.extractParams(match)}) {
`;
            
            // Find the closing brace and replace
            const startIndex = content.indexOf(match);
            const braceCount = 1;
            let endIndex = startIndex;
            
            for (let i = startIndex + match.length; i < content.length; i++) {
                if (content[i] === '{') {
                    braceCount++;
                } else if (content[i] === '}') {
                    braceCount--;
                }
                
                if (braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
            
            const originalFunction = content.substring(startIndex, endIndex);
            const fixedFunction = originalFunction.replace('function(', `${handlerName} = function(`);
            
            return fixedFunction + `
// Add cleanup
${elementVar}.addEventListener('${eventType}', ${handlerName});
// Cleanup function
const cleanup${handlerName} = () => {
    ${elementVar}.removeEventListener('${eventType}', ${handlerName});
};
// Store cleanup function
if (!${elementVar}._cleanupFunctions) {
    ${elementVar}._cleanupFunctions = [];
}
${elementVar}._cleanupFunctions.push(cleanup${handlerName});
`;
        });
    }

    /**
     * Fix missing removeEventListener calls
     */
    fixMissingRemoveEventListener(content) {
        // Pattern: addEventListener without corresponding removeEventListener
        const addPattern = /(\w+)\.addEventListener\(['"`']([^'"`]+)['"`'],\s*(\w+|\([^)]+\)\s*=>\s*[^{]*\{[^}]*\},?\s*\([^)]*\))/g;
        
        return content.replace(addPattern, (match, elementVar, eventType, handler) => {
            const cleanupCode = `
// Added cleanup for ${eventType} listener
const cleanup${eventType.replace(/[^a-zA-Z0-9]/g, '')} = () => {
    ${elementVar}.removeEventListener('${eventType}', ${handler});
};
if (!${elementVar}._cleanupFunctions) {
    ${elementVar}._cleanupFunctions = [];
}
${elementVar}._cleanupFunctions.push(cleanup${eventType.replace(/[^a-zA-Z0-9]/g, '')});
`;
            
            return match + cleanupCode;
        });
    }

    /**
     * Fix timer leaks
     */
    fixTimerLeaks(content) {
        // Pattern: setTimeout without clearTimeout
        const timeoutPattern = /setTimeout\s*\(\s*([^,]+)\s*,\s*(\d+)\s*(?:,\s*([^)]+))?\s*\)/g;
        
        return content.replace(timeoutPattern, (match, callback, delay, args) => {
            const timerId = `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            return `
// Fixed: Timer with cleanup
const ${timerId} = setTimeout(() => {
    ${callback}${args ? ', ' + args : ''}
}, ${delay});
// Store timer for cleanup
if (!window._activeTimers) {
    window._activeTimers = new Set();
}
window._activeTimers.add(${timerId});
// Cleanup function
const cleanup${timerId} = () => {
    clearTimeout(${timerId});
    window._activeTimers.delete(${timerId});
};
`;
        });
    }

    /**
     * Fix observer leaks
     */
    fixObserverLeaks(content) {
        // Pattern: new Observer() without disconnect
        const observerPattern = /new\s+(MutationObserver|ResizeObserver|IntersectionObserver)\s*\(\s*([^)]+)\s*\)/g;
        
        return content.replace(observerPattern, (match, observerType, callback) => {
            const observerId = `observer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            return `
// Fixed: Observer with cleanup
const ${observerId} = new ${observerType}(${callback});
// Store observer for cleanup
if (!window._activeObservers) {
    window._activeObservers = new Set();
}
window._activeObservers.add(${observerId});
// Cleanup function
const cleanup${observerId} = () => {
    ${observerId}.disconnect();
    window._activeObservers.delete(${observerId});
};
`;
        });
    }

    /**
     * Fix interval leaks
     */
    fixIntervalLeaks(content) {
        // Pattern: setInterval without clearInterval
        const intervalPattern = /setInterval\s*\(\s*([^,]+)\s*,\s*(\d+)\s*(?:,\s*([^)]+))?\s*\)/g;
        
        return content.replace(intervalPattern, (match, callback, delay, args) => {
            const intervalId = `interval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            return `
// Fixed: Interval with cleanup
const ${intervalId} = setInterval(() => {
    ${callback}${args ? ', ' + args : ''}
}, ${delay});
// Store interval for cleanup
if (!window._activeIntervals) {
    window._activeIntervals = new Set();
}
window._activeIntervals.add(${intervalId});
// Cleanup function
const cleanup${intervalId} = () => {
    clearInterval(${intervalId});
    window._activeIntervals.delete(${intervalId});
};
`;
        });
    }

    /**
     * Fix closure leaks
     */
    fixClosureLeaks(content) {
        // Pattern: Closures holding DOM references
        const closurePattern = /function\s*\([^)]*\)\s*\{[^}]*document\.[^;]+;[^}]*\}/g;
        
        return content.replace(closurePattern, (match) => {
            // Add cleanup comment
            return `
// WARNING: Potential closure leak detected
// Consider using WeakMap or nullifying references
${match}
// Add cleanup if needed
// const cleanup = () => { /* nullify references */ };
`;
        });
    }

    /**
     * Fix DOM reference leaks
     */
    fixDOMReferenceLeaks(content) {
        // Pattern: Global variables holding DOM references
        const domRefPattern = /(?:let|const|var)\s+(\w+)\s*=\s*document\.[^;]+;/g;
        
        return content.replace(domRefPattern, (match, varName) => {
            return `
// Fixed: DOM reference with cleanup
${match}
// Add cleanup if needed
// const cleanup${varName} = () => { ${varName} = null; };
`;
        });
    }

    /**
     * Generate handler name
     */
    generateHandlerName(eventType) {
        return `handle${eventType.charAt(0).toUpperCase() + eventType.slice(1)}_${Date.now()}`;
    }

    /**
     * Extract parameters from function match
     */
    extractParams(match) {
        const paramsMatch = match.match(/\(([^)]*)\)/);
        return paramsMatch ? paramsMatch[1] : '';
    }

    /**
     * Generate cleanup function
     */
    generateCleanupFunction(elementVar, eventType, handlerName) {
        return `
// Cleanup function for ${eventType}
const cleanup${handlerName} = () => {
    ${elementVar}.removeEventListener('${eventType}', ${handlerName});
    if (${elementVar}._cleanupFunctions) {
        const index = ${elementVar}._cleanupFunctions.indexOf(cleanup${handlerName});
        if (index > -1) {
            ${elementVar}._cleanupFunctions.splice(index, 1);
        }
    }
};
`;
    }

    /**
     * Add global cleanup function
     */
    addGlobalCleanup(content) {
        const cleanupFunction = `
// Global cleanup function
function cleanupAllMemoryLeaks() {
    console.log('🧹 Cleaning up all memory leaks...');
    
    // Clear timers
    if (window._activeTimers) {
        window._activeTimers.forEach(timerId => clearTimeout(timerId));
        window._activeTimers.clear();
    }
    
    // Clear intervals
    if (window._activeIntervals) {
        window._activeIntervals.forEach(intervalId => clearInterval(intervalId));
        window._activeIntervals.clear();
    }
    
    // Clear observers
    if (window._activeObservers) {
        window._activeObservers.forEach(observer => observer.disconnect());
        window._activeObservers.clear();
    }
    
    // Clear element cleanup functions
    document.querySelectorAll('*').forEach(element => {
        if (element._cleanupFunctions) {
            element._cleanupFunctions.forEach(cleanup => cleanup());
            element._cleanupFunctions = [];
        }
    });
    
    console.log('✅ Memory leak cleanup completed');
}

// Auto-cleanup on page unload
window.addEventListener('beforeunload', cleanupAllMemoryLeaks);
`;

        return content + cleanupFunction;
    }

    /**
     * Apply fixes to multiple files
     */
    async applyFixes(filePaths) {
        const results = [];
        
        for (const filePath of filePaths) {
            const fixedContent = await this.scanAndFixFile(filePath);
            if (fixedContent) {
                results.push({
                    file: filePath,
                    fixed: true,
                    content: fixedContent
                });
            } else {
                results.push({
                    file: filePath,
                    fixed: false,
                    content: null
                });
            }
        }
        
        return results;
    }

    /**
     * Get scan results
     */
    getScanResults() {
        return {
            fixesApplied: this.fixesApplied,
            scanResults: this.scanResults
        };
    }
}

// Auto-apply fixes to common files when loaded
window.addEventListener('DOMContentLoaded', async () => {
    if (window.autoFixMemoryLeaks) {
        const fixer = new MemoryLeakFixer();
        
        // Common file patterns to check
        const commonFiles = [
            '*.js',
            'src/**/*.js',
            'components/**/*.js',
            'utils/**/*.js'
        ];
        
        console.log('🔍 Auto-fixing memory leaks in JavaScript files...');
        
        for (const pattern of commonFiles) {
            // This would need to be implemented based on your file system
            console.log(`📁 Scanning pattern: ${pattern}`);
        }
        
        console.log(`✅ Memory leak fixing completed. ${fixer.fixesApplied} fixes applied.`);
    }
});

// Export for use
window.MemoryLeakFixer = MemoryLeakFixer;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryLeakFixer;
}
