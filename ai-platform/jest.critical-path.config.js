/** Jest config for Track 2 critical-path coverage (≥70% lines on production modules). */
const base = require('./jest.config');

const CRITICAL_PATHS = [
    'server/lib/secret-config.js',
    'server/lib/path-safety.js',
    'server/lib/npm-audit-runner.js',
    'server/lib/simplebeacon-subscription-store.js',
    'server/middleware/simplebeacon-subscription.js',
    'server/middleware/auth.js',
    'server/services/user-service.js',
    'server/bootstrap/phase2-integration.js',
    'src/api/simplebeacon-api.js',
    'src/api/simplebeacon-billing-api.js',
    'web/scripts/payload-routing.js'
];

module.exports = {
    ...base,
    collectCoverageFrom: CRITICAL_PATHS,
    coverageThreshold: {
        global: {
            lines: 70,
            statements: 70,
            functions: 70,
            branches: 60
        }
    }
};
