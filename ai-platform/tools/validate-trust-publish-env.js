const fs = require('fs');
const path = require('path');

function toBool(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function redactEndpoint(endpoint) {
    if (!endpoint) return null;
    try {
        const url = new URL(endpoint);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        return endpoint.slice(0, 96);
    }
}

function buildValidationSummary() {
    const endpoint = String(
        process.env.TRUST_PUBLISH_ENDPOINT
        || process.env.SIMPLEBEACON_TRUST_PUBLISH_URL
        || ''
    ).trim();
    const token = String(
        process.env.TRUST_PUBLISH_TOKEN
        || process.env.SIMPLEBEACON_TRUST_PUBLISH_TOKEN
        || ''
    ).trim();

    const strict = toBool(process.env.TRUST_PUBLISH_STRICT);
    const requireEndpoint = toBool(process.env.TRUST_PUBLISH_REQUIRED);
    const requireToken = toBool(process.env.TRUST_PUBLISH_REQUIRE_TOKEN);
    const allowHttp = toBool(process.env.TRUST_PUBLISH_ALLOW_HTTP);
    const requireHttps = !allowHttp;

    const warnings = [];
    const errors = [];
    const operatorActions = [];

    if (!endpoint) {
        if (requireEndpoint) {
            errors.push('TRUST_PUBLISH_REQUIRED=true but endpoint is missing.');
        } else {
            warnings.push('No trust publish endpoint configured; remote publish will be skipped.');
            operatorActions.push('Set SIMPLEBEACON_TRUST_PUBLISH_URL (or TRUST_PUBLISH_ENDPOINT) to enable remote publishing.');
        }
    } else {
        if (requireHttps && !endpoint.startsWith('https://')) {
            const msg = `Endpoint is not HTTPS: ${endpoint}`;
            if (strict) {
                errors.push(msg);
            } else {
                warnings.push(msg);
            }
            operatorActions.push('Use an HTTPS endpoint backed by valid CDN/SSL before production enablement.');
        }
    }

    if (!token) {
        if (requireToken) {
            errors.push('TRUST_PUBLISH_REQUIRE_TOKEN=true but token is missing.');
        } else {
            warnings.push('No trust publish token configured; publish will proceed without Authorization header.');
            operatorActions.push('Set SIMPLEBEACON_TRUST_PUBLISH_TOKEN for authenticated publish endpoints.');
        }
    }

    if (endpoint && endpoint.includes('localhost')) {
        warnings.push('Endpoint targets localhost; this is not suitable for production trust badge publishing.');
        operatorActions.push('Point publish endpoint to production trust API host.');
    }

    return {
        validatedAt: new Date().toISOString(),
        strict,
        requireEndpoint,
        requireToken,
        requireHttps,
        endpointConfigured: Boolean(endpoint),
        tokenConfigured: Boolean(token),
        endpointRedacted: redactEndpoint(endpoint),
        warnings,
        errors,
        operatorActions,
        ready: errors.length === 0
    };
}

function writeValidationSummary(summary, outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

function logValidationSummary(summary) {
    console.log('Trust publish environment validation');
    console.log(`  ready: ${summary.ready}`);
    console.log(`  endpoint configured: ${summary.endpointConfigured}`);
    console.log(`  token configured: ${summary.tokenConfigured}`);
    console.log(`  endpoint: ${summary.endpointRedacted || 'n/a'}`);
    if (summary.errors.length) {
        for (const error of summary.errors) {
            console.error(`  error: ${error}`);
        }
    }
    if (summary.warnings.length) {
        for (const warning of summary.warnings) {
            console.warn(`  warning: ${warning}`);
        }
    }
}

function runCli() {
    const outputPath = path.resolve(process.argv[2] || '.simplebeacon/trust-publish-env-validation.json');
    const summary = buildValidationSummary();
    writeValidationSummary(summary, outputPath);
    logValidationSummary(summary);
    if (!summary.ready) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    runCli();
}

module.exports = {
    toBool,
    buildValidationSummary,
    writeValidationSummary
};
