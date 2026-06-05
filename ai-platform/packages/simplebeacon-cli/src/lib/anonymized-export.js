/**
 * Anonymized export constants for compliance schema and external integrations.
 */

const SEVERITY_BANDS = {
    critical: 'Immediate action required — security or production integrity risk',
    high: 'Merge-risk issue or reliability/security concern in production-relevant paths',
    medium: 'Should-fix quality issue with direct maintainability/runtime impact',
    low: 'Hygiene issue; track and clean as capacity allows'
};

const ERROR_TYPE_CODES = {
    'schema-violation': 'S1',
    'syntax-error': 'S2',
    'credential-leak': 'C1',
    'production-leak': 'P1',
    'llm-slop': 'A1',
    'fiction-kpi': 'A2',
    'eu-ai-act': 'R1',
    'test-failure': 'T1',
    'duplicate-data': 'D1',
    'asset-duplicate': 'D2',
    'architecture-drift': 'AD1',
    'token-bleed': 'TB1'
};

module.exports = {
    SEVERITY_BANDS,
    ERROR_TYPE_CODES
};
