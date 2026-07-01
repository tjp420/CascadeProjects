/**
 * Static constants and lookup tables for export bundle generation.
 */

const EU_AI_ACT_ARTIFACT_IDS = new Set(['eu-ai-act-sprint', 'eu-ai-act-audit']);

/** Engine ids from Analyze → Complete queue map to ZIP artifact ids. */
const ARTIFACT_ENGINE_REQUIREMENTS = {
    'public-summary': ['simplebeacon'],
    'simplebeacon-gate': ['simplebeacon'],
    'fiction-digest': ['mock-scan'],
    'compliance-checklist': ['compliance'],
    'consolidation': ['consolidation'],
    'codebase-summary': ['codebase'],
    'file-reduction': ['file-reduction'],
    'data-quality': ['data-quality'],
    'cleanup-brief': ['cleanup-assistant'],
    'npm-audit': ['npm-audit'],
    'roadmap': ['roadmap'],
    'executive-audit': ['simplebeacon'],
    'agency-certificate': ['simplebeacon'],
    're-attestation-readme': ['simplebeacon']
};

const ENGINE_RESULT_KEYS = {
    simplebeacon: 'simplebeacon',
    'mock-scan': 'mockScan',
    consolidation: 'consolidation',
    roadmap: 'roadmap',
    codebase: 'codebase',
    'file-reduction': 'fileReduction',
    'data-quality': 'dataQuality',
    'cleanup-assistant': 'cleanupAssistant',
    compliance: 'compliance',
    'npm-audit': 'npmAudit',
    'eu-ai-act': 'sprint'
};

module.exports = {
    EU_AI_ACT_ARTIFACT_IDS,
    ARTIFACT_ENGINE_REQUIREMENTS,
    ENGINE_RESULT_KEYS
};
