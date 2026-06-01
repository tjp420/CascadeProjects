const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    isIntelligenceAvailable,
    scanIntelligenceLayer,
    resetIntelligenceCacheForTests
} = require('../src/lib/intelligence-bridge');

test('intelligence bridge loads workspace package when present', () => {
    resetIntelligenceCacheForTests();
    assert.equal(isIntelligenceAvailable(), true);
});

test('scanIntelligenceLayer returns findings for hollow AI marker code', () => {
    resetIntelligenceCacheForTests();
    const content = 'function processData(data) { return data; }\n';
    const result = scanIntelligenceLayer(content, {
        enabled: true,
        intelligence: { enabled: true, languages: ['javascript'] },
        filePath: 'src/agent.js'
    });
    assert.equal(result.available, true);
    assert.ok(Array.isArray(result.findings));
});
