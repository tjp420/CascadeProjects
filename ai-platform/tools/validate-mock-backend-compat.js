const path = require('path');

const staticPayloadPath = path.join(__dirname, '../web/api/mock-backend-static-data.js');
require(staticPayloadPath);

const MockBackendAPI = require(path.join(__dirname, '../web/api/mock-backend.js'));

async function assertEndpoint(mockApi, endpoint, expected) {
    const response = await mockApi.fetch(endpoint);
    if (!response || !response.ok) {
        throw new Error(`Expected mock response for ${endpoint}`);
    }
    const data = await response.json();
    if (!expected(data)) {
        throw new Error(`Endpoint contract check failed for ${endpoint}`);
    }
    return data;
}

async function run() {
    const mockApi = new MockBackendAPI();

    const ggufReport = await assertEndpoint(
        mockApi,
        '/api/gguf/mock-analysis-report',
        (data) => data && data.type === 'gguf-mock-data-analysis-report' && Array.isArray(data.detectedIssues)
    );

    await assertEndpoint(
        mockApi,
        '/api/gguf/mock-analysis-summary',
        (data) =>
            data &&
            typeof data.totalIssues === 'number' &&
            Array.isArray(data.topRecommendations) &&
            data.title === ggufReport.title
    );

    await assertEndpoint(
        mockApi,
        '/api/database/metrics',
        (data) => Array.isArray(data) && data.length > 0 && data[0] && data[0].id
    );

    await assertEndpoint(
        mockApi,
        '/api/analytics/alerts',
        (data) => Array.isArray(data) && data.length > 0 && data[0] && data[0].severity
    );

    console.log('mock-backend compatibility validation passed');
}

run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
