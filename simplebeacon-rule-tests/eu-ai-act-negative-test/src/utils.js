/**
 * Negative Test Case: EU AI Act — benign utility code
 * Expected Behavior: PASS — should NOT trigger EU AI Act finding
 * Reason: Generic utility functions with no high-risk AI system indicators
 * simplebeacon:eu-ai-act-patterns: test-negative-case
 */

function formatDate(date) {
    return new Date(date).toISOString();
}

function sanitizeInput(input) {
    return String(input).replace(/[<>]/g, '');
}

function calculateSum(items) {
    return items.reduce((a, b) => a + b, 0);
}

module.exports = { formatDate, sanitizeInput, calculateSum };
