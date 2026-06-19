/**
 * Optional cloud LLM providers for scan summarization (OpenAI, Anthropic, Ollama).
 * Filesystem scan always runs first; cloud calls are best-effort enhancements.
 *
 * EU AI Act Documentation Marker:
 * - Classification: Annex III AI system indicator (Generative AI / LLM integration)
 * - Article 50: Transparency — outputs are disclosed via upstream consumer (chatbot API)
 * - Article 12: Record-keeping — inference events logged via ai-inference-audit-logger
 * - Risk Level: Limited risk (user-facing assistant with disclosure)
 * - Human Oversight: Implemented at chatbot route layer
 */

const logger = require('../../src/lib/app-logger.cjs');
const { logInferenceEvent } = require('../lib/ai-inference-audit-logger.cjs');

const constants = require('../config/constants.cjs');
const DEFAULTS = {
    openai: {
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        timeoutMs: constants.TIMEOUT_30S // 30 second default
    },
    anthropic: {
        baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        timeoutMs: constants.TIMEOUT_30S // 30 second default
    },
    ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        timeoutMs: constants.TIMEOUT_1M // 60 second default
    }
};

// Circuit breaker state to prevent cascading failures
const circuitBreakerState = {
    openai: { failures: 0, lastFailure: 0, isOpen: false },
    anthropic: { failures: 0, lastFailure: 0, isOpen: false },
    ollama: { failures: 0, lastFailure: 0, isOpen: false }
};

const CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 failures
const CIRCUIT_BREAKER_TIMEOUT = constants.TIMEOUT_1M; // Reset after 60 seconds

/**
 * Resolve credential.
 * @param {Array} userCredentials
 * @param {string} providerId
 * @param {any} envKey
 * @returns {any}
 */
function resolveCredential(userCredentials, providerId, envKey) {
    const userValue = userCredentials?.[providerId];
    if (userValue) return userValue;
    return process.env[envKey] || '';
}

/**
 * Check circuit breaker.
 * @param {string} providerId
 * @returns {any}
 */
function checkCircuitBreaker(providerId) {
    const state = circuitBreakerState[providerId];
    if (!state) return false;

    if (state.isOpen) {
        const timeSinceFailure = Date.now() - state.lastFailure;
        if (timeSinceFailure > CIRCUIT_BREAKER_TIMEOUT) {
            // Reset circuit breaker
            state.isOpen = false;
            state.failures = 0;
            logger.info(`[Circuit Breaker] ${providerId} circuit reset`);
            return false;
        }
        return true; // Circuit is still open
    }
    return false;
}

/**
 * Record failure.
 * @param {string} providerId
 * @returns {any}
 */
function recordFailure(providerId) {
    const state = circuitBreakerState[providerId];
    if (!state) return;

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
        state.isOpen = true;
        logger.warn(`[Circuit Breaker] ${providerId} circuit opened after ${state.failures} failures`);
    }
}

/**
 * Record success.
 * @param {string} providerId
 * @returns {any}
 */
function recordSuccess(providerId) {
    const state = circuitBreakerState[providerId];
    if (!state) return;

    state.failures = 0;
    state.isOpen = false;
}

/**
 * Fetch with timeout.
 * @param {string} url
 * @param {Object} options
 * @param {Array} timeoutMs
 * @returns {any}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = constants.TIMEOUT_30S) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
    }
}

/**
 * Retry with backoff.
 * @param {Function} fn
 * @param {Array} maxRetries
 * @param {Array} baseDelayMs
 * @returns {any}
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelayMs = constants.ONE_SECOND_MS) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Critical Client Errors: Authentication issues or invalid requests should drop early
            if (error.message.includes('401') ||
                error.message.includes('403') ||
                error.message.includes('400') ||
                error.message.includes('authentication') ||
                error.message.includes('configured')) {
                throw error;
            }

            if (attempt === maxRetries) {
                throw error;
            }

            const delayMs = baseDelayMs * Math.pow(2, attempt);
            logger.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delayMs}ms: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw lastError;
}

/**
 * Resolve ollama base url.
 * @param {string} registry
 * @param {Array} userCredentials
 * @returns {any}
 */
function resolveOllamaBaseUrl(registry = null, userCredentials = null) {
    return userCredentials?.ollamaBaseUrl
        || registry?.ollamaBaseUrl
        || DEFAULTS.ollama.baseUrl;
}

/**
 * Resolve ollama model sync.
 * @param {string} registry
 * @param {Array} userCredentials
 * @param {Object} options
 * @returns {any}
 */
function resolveOllamaModelSync(registry = null, userCredentials = null, options = {}) {
    return options.ollamaModel
        || userCredentials?.ollamaModel
        || DEFAULTS.ollama.model
        || registry?.models?.find((m) => m.id === registry.activeModelId && m.provider === 'ollama')?.ollamaModel
        || registry?.models?.find((m) => m.provider === 'ollama' && m.ollamaModel)?.ollamaModel
        || null;
}

/**
 * Pick installed ollama model.
 * @param {any} requested
 * @param {any} available
 * @returns {any}
 */
function pickInstalledOllamaModel(requested, available = []) {
    if (!available.length) return null;
    const want = String(requested || '').trim();
    if (!want) return available[0];
    const exact = available.find((name) => name === want);
    if (exact) return exact;
    const prefixed = available.find((name) => name.startsWith(`${want}:`));
    if (prefixed) return prefixed;
    const base = available.find((name) => name.split(':')[0] === want);
    if (base) return base;
    return available[0];
}

/**
 * Resolve ollama model.
 * @param {string} registry
 * @param {Array} userCredentials
 * @param {Object} options
 * @returns {any}
 */
async function resolveOllamaModel(registry = null, userCredentials = null, options = {}) {
    const explicit = resolveOllamaModelSync(registry, userCredentials, options);
    const baseUrl = resolveOllamaBaseUrl(registry, userCredentials);

    let available = [];
    try {
        const { ollamaListModels } = require('./ollama-client.cjs');
        const listed = await ollamaListModels(baseUrl, { includeMeta: true });
        available = listed.models || [];
        if (listed.timing) {
            options._ollamaTiming = options._ollamaTiming || {};
            options._ollamaTiming.list = listed.timing;
        }
    } catch (err) {
        if (explicit) return explicit;
        // Ollama not running — return null so caller can fail fast
        return null;
    }

    if (!available.length) {
        throw new Error('ollama has no models installed — run `ollama pull llama3.2` or set Ollama model in Settings → AI providers');
    }

    const picked = pickInstalledOllamaModel(explicit, available);
    if (explicit && picked !== explicit && !available.includes(explicit)) {
        const fallbackBase = String(picked).split(':')[0];
        const requestedBase = String(explicit).split(':')[0];
        if (fallbackBase !== requestedBase) {
            options._ollamaModelFallback = { requested: explicit, used: picked };
        }
    }
    return picked;
}

/**
 * List available providers.
 * @param {string} registry
 * @param {Array} userCredentials
 * @returns {any}
 */
function listAvailableProviders(registry = null, userCredentials = null) {
    const activeModel = registry?.models?.find((m) => m.id === registry.activeModelId);
    const _ollamaRegistry = registry?.models?.some((m) => m.provider === 'ollama');
    const ollamaUrl = resolveOllamaBaseUrl(registry, userCredentials);
    const ollamaModel = resolveOllamaModelSync(registry, userCredentials);

    const entries = [
        {
            id: 'demo',
            label: 'Filesystem scan',
            description: 'Deterministic gate — no LLM inference',
            available: true
        },
        {
            id: 'active',
            label: 'Active local model',
            description: activeModel
                ? `${activeModel.name} (${activeModel.provider})`
                : 'Registry active model',
            available: Boolean(activeModel)
        },
        {
            id: 'ollama',
            label: 'Ollama',
            description: ollamaModel ? `${ollamaUrl} · ${ollamaModel}` : ollamaUrl,
            available: Boolean(ollamaUrl),
            model: ollamaModel
        },
        {
            id: 'openai',
            label: 'OpenAI',
            description: DEFAULTS.openai.model,
            available: Boolean(resolveCredential(userCredentials, 'openai', 'OPENAI_API_KEY')),
            model: DEFAULTS.openai.model
        },
        {
            id: 'anthropic',
            label: 'Anthropic',
            description: DEFAULTS.anthropic.model,
            available: Boolean(resolveCredential(userCredentials, 'anthropic', 'ANTHROPIC_API_KEY')),
            model: DEFAULTS.anthropic.model
        }
    ];

    return entries.map((entry) => ({
        ...entry,
        configured: entry.id === 'ollama'
            ? Boolean(entry.available)
            : entry.available
    }));
}

/**
 * Provider configured.
 * @param {string} providerId
 * @param {string} registry
 * @param {Array} userCredentials
 * @returns {any}
 */
function providerConfigured(providerId, registry = null, userCredentials = null) {
    if (providerId === 'ollama') {
        return Boolean(resolveOllamaBaseUrl(registry, userCredentials));
    }
    const match = listAvailableProviders(registry, userCredentials).find((p) => p.id === providerId);
    return Boolean(match?.configured || match?.available);
}

/**
 * Provider config hint.
 * @param {string} providerId
 * @returns {any}
 */
function providerConfigHint(providerId) {
    const settingsHint = 'add your key in Settings → AI providers';
    const envHints = {
        openai: `OPENAI_API_KEY in server .env, or ${settingsHint}`,
        anthropic: `ANTHROPIC_API_KEY in server .env, or ${settingsHint}`,
        ollama: `set Ollama model in Settings → AI providers (e.g. llama3.2), OLLAMA_MODEL in server .env, or register a model in Local AI Models`
    };
    return envHints[providerId] || settingsHint;
}

/**
 * Summarize scan with provider.
 * @param {string} providerId
 * @param {any} scanPayload
 * @param {Object} options
 * @returns {any}
 */
async function summarizeScanWithProvider(providerId, scanPayload, options = {}) {
    const reportType = options.reportType || scanPayload.reportKind || '';
    if (reportType === 'file-merger-reduction-report') {
        const { buildConsolidationConclusion } = require('../lib/file-merger-reduction-scanner.cjs');
        const report = scanPayload.summary
            ? scanPayload
            : {
                summary: scanPayload.mergerSummary,
                repositoryInventory: scanPayload.repositoryInventory
            };
        return {
            enhanced: true,
            provider: 'Simplebeacon rules',
            summary: buildConsolidationConclusion(report)
        };
    }

    if (!providerId || providerId === 'demo' || providerId === 'active') {
        return { enhanced: false, provider: providerId || 'demo' };
    }

    const userCredentials = options.userCredentials || null;
    if (!providerConfigured(providerId, options.registry || null, userCredentials)) {
        throw new Error(`${providerId} is not configured — ${providerConfigHint(providerId)}`);
    }

    const prompt = buildScanPrompt(scanPayload, options.projectPath, options.reportType, options);
    const providerResult = await callProvider(providerId, prompt, options);
    const summary = sanitizeSummaryText(providerResult?.text, providerId);
    logInferenceEvent({
        provider: providerId,
        operation: 'summarizeScan',
        projectLabel: redactPathForSummary(options.projectPath),
        outcome: 'ok'
    });
    const result = {
        enhanced: true,
        provider: providerId,
        summary
    };
    if (options._ollamaModelFallback) {
        result.modelFallback = options._ollamaModelFallback;
    }
    if (providerId === 'ollama' && options._ollamaTiming) {
        result.timingBuckets = options._ollamaTiming;
        logger.info('[ollama] summary timing', {
            listMs: options._ollamaTiming.list?.durationMs ?? null,
            listSource: options._ollamaTiming.list?.source || null,
            generateMs: options._ollamaTiming.generate?.durationMs ?? null,
            generateAttempts: options._ollamaTiming.generate?.attempts ?? null
        });
    }
    return result;
}

const CLOUD_SUMMARY_SYSTEM_PROMPT = 'You write concise technical audit summaries for engineering teams. Use plain bullet points only. Do not roleplay, greet the reader, invent metrics, or mention topics outside the user message. Never include full absolute file paths — use the project folder label provided.';

const OLLAMA_SUMMARY_SYSTEM_PROMPT = CLOUD_SUMMARY_SYSTEM_PROMPT;

/**
 * Redact path for summary.
 * @param {string} projectPath
 * @returns {any}
 */
function redactPathForSummary(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/').trim();
    if (!normalized) return 'project';
    const parts = normalized.split('/').filter(Boolean);
    if (/^[A-Za-z]:$/i.test(parts[0]) && parts.length > 1) {
        parts.shift();
    }
    if (parts.length <= 1) return parts[0] || 'project';
    return `…/${parts.slice(-2).join('/')}`;
}

/**
 * Count fiction issues.
 * @param {Array} issues
 * @returns {any}
 */
function countFictionIssues(issues = []) {
    return issues
        .filter((item) => /fiction|fictional|consistency|kpi/i.test(String(item.type || '')))
        .reduce((sum, item) => sum + (item.count || 1), 0);
}

/**
 * Build scan prompt.
 * @param {any} scanPayload
 * @param {string} projectPath
 * @param {number} reportType
 * @param {Object} options
 * @returns {any}
 */
function buildScanPrompt(scanPayload, projectPath, reportType = '', options = {}) {
    if (options.customPrompt) {
        return options.customPrompt;
    }
    const type = reportType || scanPayload.reportKind || '';
    const overview = scanPayload.analysisOverview || {};
    const pathLabel = redactPathForSummary(projectPath);
    const gatePass = scanPayload.gatePass;
    const gateLabel = gatePass === true ? 'PASS' : gatePass === false ? 'FAIL' : '—';
    const issues = (scanPayload.detectedIssues || []).slice(0, 8);

    if (type === 'file-merger-reduction-report') {
        const merger = scanPayload.mergerSummary || {};
/**
 * Paths.
 * @param {string} scanPayload.scanPaths || []
 * @returns {any}
 */
        const paths = (scanPayload.scanPaths || []).map((p) => redactPathForSummary(p)).join(', ') || '—';
        const repoFiles = merger.repositoryFilesTotal ?? scanPayload.repositoryInventory?.totalFiles ?? '—';
        const repoFolders = merger.repositoryFoldersTotal ?? scanPayload.repositoryInventory?.totalFolders ?? '—';
        return `Summarize this data consolidation scan in 3-5 bullet points. This is NOT a compliance gate — do not mention gate PASS/FAIL or quality scores. Use only these facts:
Project folder: ${pathLabel}
Repository files (full tree inventory): ${merger.repositoryFilesTotal ?? repoFiles ?? merger.filesAnalyzed ?? '—'}
Repository folders: ${merger.repositoryFoldersTotal ?? repoFolders ?? '—'}
JSON files hashed for duplicate detection: ${merger.jsonFilesAnalyzed ?? '—'} (this is files scanned, NOT duplicate count)
Exact duplicate groups found: ${merger.exactDuplicateGroups ?? 0}
Sample JSON paths (structure similarity scope): ${merger.sampleDataFilesAnalyzed ?? merger.filesAnalyzed ?? overview.totalMockFiles ?? '—'}
Scan paths: ${paths}
Total repository size scanned: ${merger.totalSizeLabel ?? '—'}
Merge candidates: ${merger.mergeCandidates ?? overview.issuesDetected ?? 0}
Potential savings: ${merger.potentialSavingsLabel ?? '0B'}
Oversized files: ${merger.oversizedFiles ?? 0}
Important: if duplicate groups is 0, say "0 duplicate groups" — never claim the JSON scan count equals duplicates. Lead with repository file count — sample JSON path count is a subset used for structure similarity.`;
    }

    if (type === 'codebase-analyzer-report') {
        const code = scanPayload.codebaseSummary || {};
        const categories = (scanPayload.detectedIssues || [])
            .reduce((acc, item) => {
                const key = item.type || 'other';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
        return `Summarize this codebase analysis in 3-5 bullet points. Use only these facts:
Project folder: ${pathLabel}
Repository files (audit inventory): ${code.repositoryFilesTotal ?? overview.repositoryFilesTotal ?? '—'}
Code files analyzed: ${code.codeFilesAnalyzed ?? overview.codeFilesAnalyzed ?? '—'}
Health score: ${code.healthScore ?? overview.dataQualityScore ?? '—'}%
Findings total: ${code.findingsTotal ?? overview.issuesDetected ?? 0}
High severity: ${code.severityCounts?.high ?? 0}
Medium severity: ${code.severityCounts?.medium ?? 0}
Low severity: ${code.severityCounts?.low ?? 0}
ESLint errors: ${code.eslintErrors ?? overview.eslintErrors ?? 0}
ESLint warnings: ${code.eslintWarnings ?? overview.eslintWarnings ?? 0}
Top issue types: ${Object.keys(categories).join(', ') || 'none'}
Important: this scan flags technical debt markers, broken JSON/syntax, debug artifacts, and placeholder text — not full dead-code elimination.`;
    }

    if (type === 'data-cleanup-report') {
        const cleanup = scanPayload.dataCleanupSummary || {};
        const exec = scanPayload.executiveSummary || {};
        const profile = scanPayload.scanProfile || 'data cleanup';
        const inv = scanPayload.repositoryInventory || {};
        const sev = scanPayload.aggregation?.bySeverity || {};
        const reclaimable = cleanup.reclaimableBytes ?? 0;
        const reclaimableLabel = reclaimable >= constants.BYTES_PER_MB
            ? `${(reclaimable / 1048576).toFixed(1)} MB`
            : reclaimable >= constants.BYTES_PER_KB
                ? `${Math.round(reclaimable / 1024)} KB`
                : `${reclaimable} B`;
        return `Summarize this ${profile} scan in 3-5 bullet points. This is NOT a Simplebeacon compliance gate — do not mention gate PASS/FAIL, quality scores, schema compliance, or fiction/KPI scanning unless explicitly listed below. Use only these facts:
Project folder: ${pathLabel}
Repository files inventoried: ${inv.totalFiles ?? overview.repositoryFilesTotal ?? '—'}
Repository folders: ${inv.totalFolders ?? overview.repositoryFoldersTotal ?? '—'}
Total findings: ${cleanup.totalFindings ?? overview.issuesDetected ?? '—'}
Reclaimable space (dry-run): ${reclaimableLabel}
Config findings: ${cleanup.configFindings ?? 0}; environment: ${cleanup.environmentFindings ?? 0}; dependency: ${cleanup.dependencyFindings ?? 0}
Privacy findings: ${cleanup.dataPrivacyFindings ?? 0} (${exec.security?.piiHits ?? '—'} PII hits, ${exec.security?.credentialHits ?? '—'} credential hits — typically docs/fixtures)
Orphaned data files: ${exec.data?.orphanedDataFiles ?? cleanup.dataLineageFindings ?? '—'}
Sync I/O hot paths: ${exec.data?.syncIoPatterns ?? cleanup.dataAccessFindings ?? '—'}
Critical/high severity: ${sev.critical ?? 0} critical, ${sev.high ?? 0} high
Priority actions: ${(exec.priorityActions || []).map((a) => a.title).join('; ') || 'none listed'}
Important: Lead with repository inventory and total findings. PII/credential hits are usually in documentation, archives, or test fixtures — say that when counts are non-zero. Do not roleplay or greet the reader.`;
    }

    if (options.summaryFocus === 'fiction') {
        const fictionHits = countFictionIssues(issues);
        const jsonScanned = scanPayload.fictionJsonFilesScanned
            ?? scanPayload.scanScope?.fictionJsonFilesScanned
            ?? overview.totalMockFiles
            ?? '—';
        const sampleScanned = scanPayload.fictionSampleFilesScanned
            ?? scanPayload.scanScope?.fictionSampleFilesScanned
            ?? '—';
        const repoFiles = overview.repositoryFilesTotal ?? scanPayload.repositoryInventory?.totalFiles ?? '—';
        return `Summarize this fiction/KPI scan in 3-5 bullet points. Use only these facts:
Project folder: ${pathLabel}
Repository files (inventory): ${repoFiles}
JSON files scanned for fiction/KPI patterns: ${jsonScanned} (includes ${sampleScanned} *-sample.json files)
Fiction/KPI pattern hits: ${fictionHits}
Gate result (configured severities): ${gateLabel}
Important: fiction scanning applies to JSON files only — not all ${repoFiles} repo files are KPI-pattern scanned.
Do not mention schema compliance, quality score, credentials, or production leaks — out of scope.
Use the phrase "sample-suffix subset" instead of "template sample".`;
    }

    if (type === 'roadmap-strategic-metrics') {
        const overview = scanPayload.analysisOverview || {};
        const roadmap = scanPayload.roadmapSummary || {};
        return `Write a boardroom-ready strategic engineering summary in 4-6 bullet points. Use only these deterministic facts — do not invent metrics:
Project: ${roadmap.projectName || pathLabel}
Repository files inventoried: ${overview.repositoryFilesTotal ?? '—'}
Code files analyzed: ${overview.codeFilesAnalyzed ?? '—'}
API routes detected: ${overview.apiRouteCount ?? '—'}
Sprint completion rate: ${overview.completionRate ?? '—'}%
Test coverage: ${overview.testCoverage ?? 'not measured'}%
Development phases: ${overview.phaseCount ?? '—'}
Project health signal: ${overview.projectHealth ?? '—'}
Immediate actions from filesystem roadmap: ${(roadmap.immediateActions || []).join('; ') || 'none listed'}
Short-term actions: ${(roadmap.shortTermActions || []).slice(0, 3).join('; ') || 'none listed'}
Data source: ${roadmap.dataSource || 'filesystem-scan'} (deterministic — not AI-generated metrics)
Include one bullet on risk level and one on recommended priority. Do not claim SOC 2 or HIPAA compliance unless test coverage is provided and >= 70%.`;
    }

    const schemaLine = overview.schemaFilesChecked > 0
        ? `Schema compliance: ${overview.schemaFilesPassed ?? '—'}/${overview.schemaFilesChecked}\n`
        : '';
    const breakdown = scanPayload.issueBreakdown || {};
    return `Summarize this Simplebeacon gate scan in 3-5 bullet points. Use only these facts:
Project folder: ${pathLabel}
Repository files (full tree inventory): ${overview.repositoryFilesTotal ?? scanPayload.repositoryInventory?.totalFiles ?? '—'}
Gate rules checked (mock + credentials + server/): ${overview.ruleScopedFilesAnalyzed ?? overview.totalMockFiles ?? '—'}
JSON files fiction/KPI pattern-scanned: ${overview.fictionJsonFilesScanned ?? scanPayload.fictionJsonFilesScanned ?? '—'}
Mock and sample files in scan paths: ${overview.totalMockFiles ?? '—'}
Quality score: ${overview.dataQualityScore ?? '—'}%
Production-path references: ${breakdown.productionLeaks ?? 0}
Credential patterns: ${breakdown.credentials ?? 0}
Schema violations: ${breakdown.schema ?? 0}
Fiction/KPI patterns: ${breakdown.fiction ?? 0}
${schemaLine}Gate result: ${gateLabel} (configured severities — PASS allows non-blocking MEDIUM/LOW findings)
Top issue types: ${issues.map((i) => i.type).join(', ') || 'none'}
Important: The repository file count is a full-tree inventory (includes node_modules). Gate rule checks and mock/sample counts are smaller scoped subsets — NOT every repo file is semantically analyzed. Lead your first bullet with the repository inventory count, then gate rules checked, then JSON fiction-scanned if present, then mock/sample count. Never imply only mock/sample files were scanned when repository inventory is provided.
Do not call production-path references "blocking issues" when gate is PASS.`;
}

/**
 * Sanitize summary text.
 * @param {string} text
 * @param {string} providerId
 * @returns {any}
 */
function sanitizeSummaryText(text, providerId = '') {
    const raw = text && typeof text === 'object' ? text.text : text;
    let out = String(raw || '').trim();
    if (providerId !== 'ollama') {
        out = out.replace(/^(?:mortal seeker[^.\n]*[.\n]+)/i, '').trim();
        out = out.replace(/^(?:i shall (?:decipher|decode)[^.\n]*[.\n]+)/i, '').trim();
    }
    out = out.replace(/[A-Za-z]:[\\/][^\s,)]+/g, (match) => redactPathForSummary(match));
    out = out.replace(/(?:\(|\s)([A-Za-z]:[\\/][^\s,)]+)/g, (_, path) => ` (${redactPathForSummary(path)})`);
    return out || String(text || '').trim();
}

/**
 * Call provider.
 * @param {string} providerId
 * @param {any} prompt
 * @param {Object} options
 * @returns {any}
 */
async function callProvider(providerId, prompt, options = {}) {
    // Check circuit breaker before attempting request
    if (checkCircuitBreaker(providerId)) {
        throw new Error(`503: The circuit breaker for provider '${providerId}' is currently open due to high error frequencies. Try again later.`);
    }

    try {
        const result = await retryWithBackoff(async () => {
            switch (providerId) {
                case 'openai':
                    return callOpenAI(prompt, options);
                case 'anthropic':
                    return callAnthropic(prompt, options);
                case 'ollama':
                    return callOllama(prompt, options);
                default:
                    throw new Error(`Unsupported cloud provider: ${providerId}`);
            }
        }, 3, constants.ONE_SECOND_MS);

        recordSuccess(providerId);
        return result;
    } catch (error) {
        recordFailure(providerId);
        throw error;
    }
}

/**
 * Normalize messages.
 * @param {any} input
 * @param {Object} options
 * @returns {any}
 */
function normalizeMessages(input, options = {}) {
    if (Array.isArray(input) && input.length > 0 && typeof input[0] === 'object' && 'role' in input[0]) {
        return input;
    }
    return [
        { role: 'system', content: options.systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: input }
    ];
}

/**
 * Call open a i.
 * @param {any} prompt
 * @param {Object} options
 * @returns {any}
 */
async function callOpenAI(prompt, options = {}) {
    const cfg = DEFAULTS.openai;
    const apiKey = resolveCredential(options.userCredentials, 'openai', 'OPENAI_API_KEY');
    if (!apiKey) {
        throw new Error(`401: OpenAI API key is missing or not configured`);
    }
    const messages = normalizeMessages(prompt, options);
    const timeoutMs = options.timeoutMs || cfg.timeoutMs;

    const response = await fetchWithTimeout(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: options.model || cfg.model,
            messages: messages,
            temperature: 0.2,
            max_tokens: 400
        })
    }, timeoutMs);

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || `OpenAI request failed (${response.status})`);
    }
    const data = await response.json();
    return {
        text: data.choices?.[0]?.message?.content?.trim() || '',
        provider: 'openai',
        timing: null
    };
}

/**
 * Call anthropic.
 * @param {any} prompt
 * @param {Object} options
 * @returns {any}
 */
async function callAnthropic(prompt, options = {}) {
    const cfg = DEFAULTS.anthropic;
    const apiKey = resolveCredential(options.userCredentials, 'anthropic', 'ANTHROPIC_API_KEY');
    if (!apiKey) {
        throw new Error(`401: Anthropic API key is missing or not configured`);
    }
    const messages = normalizeMessages(prompt, options);
    const timeoutMs = options.timeoutMs || cfg.timeoutMs;

    // Convert system/user/assistant context array format to Anthropic structure cleanly
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const response = await fetchWithTimeout(`${cfg.baseUrl.replace(/\/$/, '')}/messages`, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: options.model || cfg.model,
            max_tokens: 400,
            system: systemMessage,
            messages: filteredMessages
        })
    }, timeoutMs);

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || `Anthropic request failed (${response.status})`);
    }
    const data = await response.json();
/**
 * Block.
 * @param {any} data.content || []
 * @returns {any}
 */
    const block = (data.content || []).find((item) => item.type === 'text');
    return {
        text: block?.text?.trim() || '',
        provider: 'anthropic',
        timing: null
    };
}

/**
 * Call ollama.
 * @param {any} prompt
 * @param {Object} options
 * @returns {any}
 */
async function callOllama(prompt, options = {}) {
    const { ollamaGenerate } = require('./ollama-client.cjs');
    const baseUrl = resolveOllamaBaseUrl(options.registry || null, options.userCredentials || null);
    const model = await resolveOllamaModel(
        options.registry || null,
        options.userCredentials || null,
        options
    );
    if (!model) {
        throw new Error('Ollama is not configured — start Ollama with `ollama serve`, then pull a model (e.g. `ollama pull llama3.2`)');
    }
    const messages = normalizeMessages(prompt, options);
    const timeoutMs = options.timeoutMs || DEFAULTS.ollama.timeoutMs;

    let conversationalPrompt = '';
    let systemPrompt = options.systemPrompt || OLLAMA_SUMMARY_SYSTEM_PROMPT;
    if (Array.isArray(messages)) {
        const hasSystem = messages.some(m => m.role === 'system');
        const nonSystem = hasSystem ? messages.filter(m => m.role !== 'system') : messages;
        if (hasSystem) {
            const systemMsg = messages.find(m => m.role === 'system');
            systemPrompt = systemMsg.content;
        }
        conversationalPrompt = nonSystem.map(m => {
            if (m.role === 'user') return `User: ${m.content}`;
            if (m.role === 'assistant') return `Assistant: ${m.content}`;
            return `${m.role}: ${m.content}`;
        }).join('\n\n') + '\n\nAssistant:';
    } else {
        conversationalPrompt = String(prompt);
    }
    const generated = await ollamaGenerate(baseUrl, model, conversationalPrompt, {
        timeoutMs: timeoutMs,
        system: systemPrompt,
        includeMeta: true
    });
    if (generated?.timing) {
        options._ollamaTiming = options._ollamaTiming || {};
        options._ollamaTiming.generate = generated.timing;
    }
    return {
        text: generated?.response || '',
        provider: 'ollama',
        timing: generated?.timing || null
    };
}

const CODE_UNDERSTANDING_SYSTEM = 'You explain code purpose for engineering audits. Use 4-6 bullet points. Ground every claim in the provided facts. Do not invent metrics, file paths, or business requirements not present in the input.';

/**
 * Build code understanding prompt.
 * @param {any} payload
 * @returns {any}
 */
function buildCodeUnderstandingPrompt(payload = {}) {
    const findings = (payload.staticFindings || [])
        .map((f) => `- ${f.category}/${f.type}: ${f.description}`)
        .join('\n') || 'none listed';

    const safeFileLabel = redactPathForSummary(payload.filePath) || 'snippet';

    return `Explain this code for an engineering team.

File: ${safeFileLabel}
Language: ${payload.language || 'unknown'}
Deterministic purpose guess: ${payload.purpose || 'unknown'}
Business domains detected: ${(payload.businessDomains || []).join(', ') || 'none'}
Assumptions flagged: ${(payload.assumptions || []).join('; ') || 'none'}
Static findings:
${findings}

Code excerpt:
${String(payload.code || '').slice(0, 10000)}

Answer with:
1. Primary purpose (what it does)
2. Problem it appears to solve
3. Business/domain role
4. Risks or gaps visible from the excerpt
5. What a domain expert should validate manually`;
}

/**
 * Explain code with provider.
 * @param {string} providerId
 * @param {any} payload
 * @param {Object} options
 * @returns {any}
 */
async function explainCodeWithProvider(providerId, payload, options = {}) {
    if (!providerId || providerId === 'demo' || providerId === 'active') {
        return { enhanced: false, provider: providerId || 'demo' };
    }

    if (!providerConfigured(providerId, options.registry || null, options.userCredentials)) {
        throw new Error(`${providerId} is not configured — ${providerConfigHint(providerId)}`);
    }

    const prompt = buildCodeUnderstandingPrompt(payload);
    const explanationResult = await callProvider(providerId, prompt, {
        ...options,
        systemPrompt: CODE_UNDERSTANDING_SYSTEM
    });
    const explanation = sanitizeSummaryText(explanationResult?.text, providerId);

    logInferenceEvent({
        provider: providerId,
        operation: 'explainCode',
        projectLabel: payload?.projectLabel || payload?.relativePath || null,
        outcome: 'ok'
    });

    return {
        enhanced: true,
        provider: providerId,
        explanation
    };
}

module.exports = {
    listAvailableProviders,
    providerConfigured,
    summarizeScanWithProvider,
    explainCodeWithProvider,
    generateWithProvider: callProvider
};
