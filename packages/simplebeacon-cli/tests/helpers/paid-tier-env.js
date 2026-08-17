/**
 * Test helper — set paid-tier license env for MCP/integration tests.
 */
const { generateLicenseToken } = require('../../src/lib/license-token');

const TEST_SECRET = 'mcp-paid-tier-test-secret';

function withPaidTierEnv(fn) {
    const token = generateLicenseToken({ email: 'mcp-test@simplebeacon.ai', tier: 'pro' }, TEST_SECRET, 60);
    const prevToken = process.env.SIMPLEBEACON_LICENSE_TOKEN;
    const prevSecret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    process.env.SIMPLEBEACON_LICENSE_SECRET = TEST_SECRET;
    process.env.SIMPLEBEACON_LICENSE_TOKEN = token;
    try {
        return fn();
    } finally {
        if (prevToken === undefined) delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
        else process.env.SIMPLEBEACON_LICENSE_TOKEN = prevToken;
        if (prevSecret === undefined) delete process.env.SIMPLEBEACON_LICENSE_SECRET;
        else process.env.SIMPLEBEACON_LICENSE_SECRET = prevSecret;
    }
}

async function withPaidTierEnvAsync(fn) {
    const token = generateLicenseToken({ email: 'mcp-test@simplebeacon.ai', tier: 'pro' }, TEST_SECRET, 60);
    const prevToken = process.env.SIMPLEBEACON_LICENSE_TOKEN;
    const prevSecret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    process.env.SIMPLEBEACON_LICENSE_SECRET = TEST_SECRET;
    process.env.SIMPLEBEACON_LICENSE_TOKEN = token;
    try {
        return await fn();
    } finally {
        if (prevToken === undefined) delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
        else process.env.SIMPLEBEACON_LICENSE_TOKEN = prevToken;
        if (prevSecret === undefined) delete process.env.SIMPLEBEACON_LICENSE_SECRET;
        else process.env.SIMPLEBEACON_LICENSE_SECRET = prevSecret;
    }
}

function paidTierEnv() {
    const token = generateLicenseToken({ email: 'mcp-test@simplebeacon.ai', tier: 'pro' }, TEST_SECRET, 60);
    return {
        ...process.env,
        SIMPLEBEACON_LICENSE_SECRET: TEST_SECRET,
        SIMPLEBEACON_LICENSE_TOKEN: token
    };
}

module.exports = {
    TEST_SECRET,
    withPaidTierEnv,
    withPaidTierEnvAsync,
    paidTierEnv
};
