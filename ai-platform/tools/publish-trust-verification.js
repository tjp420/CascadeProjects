/**
 * Publish trust-verification.json for static hosting (e.g. trust.simplebeacon.ai).
 * Run after scans write reports: npm run trust:refresh (or simplebeacon:report + trust:publish)
 */

const fs = require('fs');
const path = require('path');
const { buildTrustVerificationPayload } = require('../server/lib/trust-verification-payload');
const {
    resolveTrustHistoryPath,
    appendTrustSnapshot
} = require('../server/lib/trust-history-store');
const {
    buildValidationSummary,
    writeValidationSummary
} = require('./validate-trust-publish-env');
const { PUBLIC_TRUST_PATH } = require('../src/api/trust-api');

function toBool(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function resolveRemotePublishConfig() {
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
    return {
        endpoint,
        token,
        requireEndpoint: toBool(process.env.TRUST_PUBLISH_REQUIRED),
        requireToken: toBool(process.env.TRUST_PUBLISH_REQUIRE_TOKEN),
        strict: toBool(process.env.TRUST_PUBLISH_STRICT),
        allowHttp: toBool(process.env.TRUST_PUBLISH_ALLOW_HTTP)
    };
}

function resolveAuditConfig(platformRoot) {
    return {
        auditPath: path.join(platformRoot, '.simplebeacon', 'trust-publish-audit.json'),
        envValidationPath: path.join(platformRoot, '.simplebeacon', 'trust-publish-env-validation.json')
    };
}

function writePublishAudit(auditPath, payload) {
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.writeFileSync(auditPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function publishRemoteTrustPayload(payload) {
    const cfg = resolveRemotePublishConfig();
    if (!cfg.endpoint) {
        if (cfg.requireEndpoint) {
            throw new Error(
                'TRUST_PUBLISH_REQUIRED is enabled, but TRUST_PUBLISH_ENDPOINT (or SIMPLEBEACON_TRUST_PUBLISH_URL) is missing.'
            );
        }
        console.log('Remote publish skipped: set TRUST_PUBLISH_ENDPOINT to enable.');
        return { skipped: true, reason: 'missing-endpoint' };
    }

    if (!cfg.allowHttp && !cfg.endpoint.startsWith('https://')) {
        const message = `Remote publish blocked: endpoint must be https (${cfg.endpoint}).`;
        if (cfg.strict) throw new Error(message);
        console.warn(message);
        return { skipped: true, reason: 'invalid-endpoint-scheme' };
    }

    if (!cfg.token) {
        const tokenWarning = 'Remote publish token is not set (TRUST_PUBLISH_TOKEN / SIMPLEBEACON_TRUST_PUBLISH_TOKEN).';
        if (cfg.requireToken) {
            throw new Error(`TRUST_PUBLISH_REQUIRE_TOKEN is enabled. ${tokenWarning}`);
        }
        console.warn(`${tokenWarning} Continuing without Authorization header.`);
    }

    try {
        const response = await fetch(cfg.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {})
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ''}`);
        }
        console.log(`Trust verification remote publish succeeded: ${cfg.endpoint}`);
        return { skipped: false };
    } catch (error) {
        if (cfg.strict) throw error;
        console.warn(`Remote publish warning (non-blocking): ${error.message}`);
        return { skipped: true, reason: 'request-failed' };
    }
}

async function main() {
    const platformRoot = path.resolve(process.argv[2] || process.cwd());
    const monorepoRoot = path.resolve(process.argv[3] || path.join(platformRoot, '..'));
    const historyPath = resolveTrustHistoryPath(platformRoot);
    const historyLimit = Number.parseInt(process.env.TRUST_HISTORY_MAX || '', 10) || undefined;
    const auditCfg = resolveAuditConfig(platformRoot);
    const envValidation = buildValidationSummary();
    writeValidationSummary(envValidation, auditCfg.envValidationPath);
    if (!envValidation.ready) {
        throw new Error(`Trust publish environment validation failed. See ${auditCfg.envValidationPath}`);
    }

    const payload = buildTrustVerificationPayload({ platformRoot, monorepoRoot });
    fs.mkdirSync(path.dirname(PUBLIC_TRUST_PATH), { recursive: true });
    fs.writeFileSync(PUBLIC_TRUST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    const signinTrust = path.join(monorepoRoot, 'deployments', 'signin-site', 'trust-verification.json');
    if (fs.existsSync(signinTrust)) {
        const pubStat = fs.statSync(PUBLIC_TRUST_PATH);
        const signinStat = fs.statSync(signinTrust);
        if (pubStat.ino !== signinStat.ino || pubStat.dev !== signinStat.dev) {
            fs.copyFileSync(PUBLIC_TRUST_PATH, signinTrust);
        }
    } else if (fs.existsSync(path.dirname(signinTrust))) {
        fs.copyFileSync(PUBLIC_TRUST_PATH, signinTrust);
    }
    const historyWrite = appendTrustSnapshot({
        payload,
        historyPath,
        maxEntries: historyLimit,
        source: 'trust:publish'
    });

    let remoteResult = { skipped: true, reason: 'not-executed' };
    let remoteError = null;
    try {
        remoteResult = await publishRemoteTrustPayload(payload);
    } catch (error) {
        remoteError = error;
    }

    const auditRecord = {
        generatedAt: new Date().toISOString(),
        verificationId: payload.verificationId || null,
        mode: {
            strict: envValidation.strict,
            endpointRequired: envValidation.requireEndpoint,
            tokenRequired: envValidation.requireToken
        },
        localArtifact: PUBLIC_TRUST_PATH,
        historyArtifact: historyWrite.historyPath,
        envValidationPath: auditCfg.envValidationPath,
        envValidationReady: envValidation.ready,
        remote: remoteError
            ? { status: 'error', message: remoteError.message }
            : remoteResult.skipped
                ? { status: 'skipped', reason: remoteResult.reason || 'skipped' }
                : { status: 'published' },
        headline: payload.headline || null
    };
    writePublishAudit(auditCfg.auditPath, auditRecord);

    console.log(`Trust verification published: ${PUBLIC_TRUST_PATH}`);
    console.log(`  verificationId: ${payload.verificationId}`);
    console.log(`  platform gate: ${payload.platform?.gatePass ?? '—'} (${payload.platform?.issueCount ?? '—'} issues)`);
    if (payload.monorepo) {
        console.log(`  monorepo gate: ${payload.monorepo.gatePass ?? '—'} (${payload.monorepo.issueCount ?? '—'} issues)`);
    }
    if (payload.repositoryHealth?.headline) {
        const h = payload.repositoryHealth.headline;
        console.log(`  repo health: ${h.repositoryHealthScore}/100 · ${h.optimizationPotential || '—'} savings`);
    }
    console.log(`  history snapshot: ${historyWrite.historyPath} (${historyWrite.count} entries)`);
    console.log(`  publish audit: ${auditCfg.auditPath}`);

    if (remoteError) {
        throw remoteError;
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
