/**
 * Deep Nesting Refactoring Example
 * Demonstrates how to refactor deeply nested code for better readability
 */

// ==================== PROBLEMATIC CODE (8 levels) ====================
function problematicParseData(data) {
    if (data) {
        if (data.items) {
            for (const item of data.items) {
                if (item.valid) {
                    if (item.type === 'A') {
                        if (item.subtype) {
                            if (item.processed) {
                                if (item.ready) {
                                    if (item.active) {
                                        // Deep nesting! What are we doing here?
                                        console.log('Processing deeply nested item:', item);
                                        return item.value;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
}

// ==================== REFACTORED CODE (3 levels) ====================

// Approach 1: Early Returns + Function Extraction
function refactoredParseData(data) {
    if (!data || !data.items) {
        return null;
    }
    
    return data.items
        .filter(item => item.valid)
        .filter(item => item.type === 'A')
        .filter(item => canProcessTypeA(item))
        .map(processTypeAItem)
        .find(result => result !== null);
}

function canProcessTypeA(item) {
    return item.subtype && 
           item.processed && 
           item.ready && 
           item.active;
}

function processTypeAItem(item) {
    return item.value;
}

// Approach 2: Pipeline Pattern
function pipelineParseData(data) {
    const pipeline = [
        validateData,
        extractItems,
        filterValidItems,
        filterTypeA,
        filterProcessable,
        extractValue
    ];
    
    return pipeline.reduce((result, fn) => fn(result), data);
}

function validateData(data) {
    return data && data.items ? data : null;
}

function extractItems(data) {
    return data.items;
}

function filterValidItems(items) {
    return items.filter(item => item.valid);
}

function filterTypeA(items) {
    return items.filter(item => item.type === 'A');
}

function filterProcessable(items) {
    return items.filter(item => 
        item.subtype && 
        item.processed && 
        item.ready && 
        item.active
    );
}

function extractValue(items) {
    return items.length > 0 ? items[0].value : null;
}

// Approach 3: Strategy Pattern
class DataParser {
    constructor() {
        this.strategies = {
            'A': new TypeAStrategy(),
            'B': new TypeBStrategy(),
            'default': new DefaultStrategy()
        };
    }
    
    parse(data) {
        if (!data || !data.items) {
            return null;
        }
        
        const validItems = data.items.filter(item => item.valid);
        
        for (const item of validItems) {
            const strategy = this.strategies[item.type] || this.strategies.default;
            const result = strategy.process(item);
            if (result !== null) {
                return result;
            }
        }
        
        return null;
    }
}

class TypeAStrategy {
    process(item) {
        if (!item.subtype || !item.processed || !item.ready || !item.active) {
            return null;
        }
        
        return item.value;
    }
}

class TypeBStrategy {
    process(item) {
        // Different processing logic for type B
        return item.processed ? item.data : null;
    }
}

class DefaultStrategy {
    process(item) {
        return item.value || null;
    }
}

// ==================== DASHBOARD SPECIFIC EXAMPLE ====================

// Before: Deep nesting in dashboard data processing
function problematicDashboardProcessing(response) {
    if (response) {
        if (response.data) {
            if (response.data.analysis) {
                if (response.data.analysis.quality) {
                    if (response.data.analysis.quality.metrics) {
                        if (response.data.analysis.quality.metrics.testCoverage) {
                            if (response.data.analysis.quality.metrics.testCoverage > 80) {
                                if (response.data.analysis.quality.metrics.testCoverage < 95) {
                                    return 'Good coverage, room for improvement';
                                } else {
                                    return 'Excellent coverage';
                                }
                            } else {
                                return 'Needs improvement';
                            }
                        }
                    }
                }
            }
        }
    }
    return 'Unknown';
}

// After: Refactored with early returns and clear logic
function refactoredDashboardProcessing(response) {
    const coverage = extractTestCoverage(response);
    return evaluateCoverage(coverage);
}

function extractTestCoverage(response) {
    return response?.data?.analysis?.quality?.metrics?.testCoverage;
}

function evaluateCoverage(coverage) {
    if (!coverage) {
        return 'Unknown';
    }
    if (coverage > 95) {
        return 'Excellent coverage';
    }
    if (coverage > 80) {
        return 'Good coverage, room for improvement';
    }
    return 'Needs improvement';
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Creates a validator function that checks multiple conditions
 * @param {Array} conditions - Array of condition functions
 * @returns {Function} Validator function
 */
function createValidator(conditions) {
    return (item) => conditions.every(condition => condition(item));
}

/**
 * Creates a processor function with validation
 * @param {Function} validator - Validation function
 * @param {Function} processor - Processing function
 * @returns {Function} Processor with validation
 */
function createProcessor(validator, processor) {
    return (item) => validator(item) ? processor(item) : null;
}

// Usage example:
const typeAValidator = createValidator([
    item => item.valid,
    item => item.type === 'A',
    item => item.subtype,
    item => item.processed,
    item => item.ready,
    item => item.active
]);

const typeAProcessor = createProcessor(typeAValidator, item => item.value);

// ==================== EXPORT ====================
window.DeepNestingExample = {
    problematicParseData,
    refactoredParseData,
    pipelineParseData,
    DataParser,
    problematicDashboardProcessing,
    refactoredDashboardProcessing,
    createValidator,
    createProcessor
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepNestingExample;
}
