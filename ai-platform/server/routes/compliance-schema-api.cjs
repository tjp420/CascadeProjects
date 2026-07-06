const { ERROR_TYPE_CODES, SEVERITY_BANDS, RULE_CATALOG, LEAK_PATTERNS } = require('../lib/simplebeacon-proxy.cjs');

/**
 * GET /api/compliance/schema — Public deterministic rule catalog.
 *
 * Returns the full Simplebeacon rule taxonomy without requiring any project
 * access or source code. External agents (Cursor, AI assistants, Windsurf) can call
 * this to learn what patterns are banned before writing code.
 *
 * This endpoint is stateless, requires no authentication, and never sees
 * user source code. It only serves the Conductor's rule definitions.
 */


/**
 * Build schema payload.
 * @returns {any}
 */
function buildSchemaPayload() {
    return {
        schemaVersion: 'simplebeacon-rules-v1',
        generatedAt: new Date().toISOString(),
        deterministic: true,
        usesLlm: false,
        categories: [
            { id: 'schema', label: 'JSON Schema Compliance', severityDefault: 'high' },
            { id: 'syntax', label: 'Syntax / Structural', severityDefault: 'high' },
            { id: 'security', label: 'Credential & Production Leak', severityDefault: 'critical' },
            { id: 'ai-quality', label: 'AI-Generated Slop & Fiction KPI', severityDefault: 'medium' },
            { id: 'compliance', label: 'Regulatory (EU AI Act)', severityDefault: 'medium' },
            { id: 'testing', label: 'Test Baseline', severityDefault: 'high' },
            { id: 'data-quality', label: 'Data Hygiene', severityDefault: 'low' }
        ],
        severityBands: SEVERITY_BANDS,
        anonymizedTypeCodes: ERROR_TYPE_CODES,
        patterns: {
            llmSlop: RULE_CATALOG.map((r) => ({
                id: r.id,
                category: 'ai-quality',
                severity: r.severity,
                summary: r.description,
                banned: true
            })),
            productionLeak: LEAK_PATTERNS.map((r) => ({
                id: r.id,
                category: 'security',
                severity: 'critical',
                summary: r.description || `Leak pattern ${r.id}`,
                banned: true
            }))
        },
        integration: {
            mcpEndpoint: '/mcp',
            cliScanCommand: 'npx simplebeacon scan --anonymize --format json',
            privacyNote: 'No source code ever uploaded. Scan runs locally; only abstract tokens leave the machine.',
            localRemediation: 'npx simplebeacon scan --fix --local-model llama3.2'
        }
    };
}

/**
 * Register compliance schema route.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function registerComplianceSchemaRoute(app, options = {}) {
    if (app.__complianceSchemaRouteRegistered) return;
    app.__complianceSchemaRouteRegistered = true;

    const basePath = options.basePath || '/api/compliance';

    app.get(`${basePath}/schema`, (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(buildSchemaPayload());
    });

    app.get(`${basePath}/schema/anonymized-v1`, (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json({
            schemaVersion: 'anonymized-v1',
            specification: 'AI-blind compliance token format',
            fields: {
                repoFingerprint: 'SHA-256 hash of project root (salted) — identifies repo without revealing path',
                rulesFingerprint: 'SHA-256 hash of active ruleset names — proves which rules were evaluated',
                gate: { pass: 'boolean', blockingCount: 'number', warningCount: 'number' },
                metrics: 'Aggregated counts only — no file paths, no code snippets, no descriptions',
                issues: 'Array of abstract tokens: { i, t (type code), c (category), s (severity), n (count) }',
                aggregate: 'Rollups by type, severity, and category'
            },
            integrity: {
                _integrity: 'HMAC-SHA256 signature of payload — prevents tampering',
                _integrityAlgo: 'hmac-sha256'
            },
            privacyGuarantees: [
                'No source code leaves the developer machine',
                'No file paths transmitted',
                'No human-readable issue descriptions',
                'No variable names, API keys, or proprietary strings',
                'Server receives only numeric error codes and compliance counts'
            ]
        });
    });
}

module.exports = { registerComplianceSchemaRoute, buildSchemaPayload };
