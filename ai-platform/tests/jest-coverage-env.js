const path = require('path');

if (!process.env.JEST_COVERAGE_SUMMARY_PATH) {
    process.env.JEST_COVERAGE_SUMMARY_PATH = path.join(__dirname, 'fixtures/jest-coverage-summary.json');
}
