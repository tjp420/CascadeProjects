/**
 * EU AI Act readiness patterns — high-risk indicators (Annex III), Article 50
 * transparency, and documentation completeness signals.
 *
 * Static pattern scan only — not legal advice or formal conformity assessment.
 */

const fs = require('fs');
const path = require('path');
const { globMatch, walkProductionFiles } = require('./production-leak');

const DEFAULT_SOURCE_PATHS = ['server', 'src', 'web', 'lib', 'packages', 'app', 'api', 'config', 'docs'];
const DEFAULT_PRODUCTION_PATHS = ['server/', 'src/', 'app/', 'lib/', 'api/', 'web/'];
const SCANNABLE_EXTENSIONS = new Set([
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.html', '.vue', '.svelte',
    '.md', '.yaml', '.yml', '.toml', '.txt'
]);
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
    '.simplebeacon', 'tests', 'test', '__tests__', 'fixtures', 'examples',
    'coming-soon', 'reports', 'security-reports', 'templates', 'data-central',
    'deployments', 'public', 'functions', 'cloudflare-deploy', 'temp', 'tests-legacy',
    '.github-sync', '.cursor', '.vscode', 'downloads', 'findings',
    'sb-analyze', 'sb-upload', 'sb-uploads', 'sb-web'
]);
const MAX_SCAN_BYTES = 512000;

const DOCUMENTATION_MARKERS = [
    { id: 'model-card', pattern: /model[-_\s]?card/i, label: 'Model card' },
    { id: 'technical-documentation', pattern: /technical[-_\s]?documentation|ai[-_\s]?system[-_\s]?documentation/i, label: 'Technical documentation' },
    { id: 'risk-assessment', pattern: /risk[-_\s]?assessment|fundamental[-_\s]?rights[-_\s]?impact/i, label: 'Risk assessment / FRIA' },
    { id: 'conformity-declaration', pattern: /conformity[-_\s]?declaration|eu[-_\s]?declaration[-_\s]?of[-_\s]?conformity/i, label: 'Conformity declaration' },
    { id: 'eu-ai-act', pattern: /eu[-_\s]?ai[-_\s]?act|regulation\s*\(\s*eu\s*\)\s*2024\/1689/i, label: 'EU AI Act reference' }
];

const DOCUMENTATION_FILE_NAMES = [
    'model-card.md',
    'MODEL_CARD.md',
    'ai-system-documentation.md',
    'risk-assessment.md',
    'conformity-declaration.md',
    'eu-ai-act-compliance.md'
];

const HIGH_RISK_CATALOG = [
    {
        id: 'EUAI-HR-001',
        annex: 'III.4',
        category: 'high-risk',
        type: 'EU AI Act — High-Risk Indicator',
        regex: /\b(?:resume|curriculum\s+vitae|cv)\s*(?:screen|scor|rank|filter|match)|(?:candidate|applicant)\s*(?:scor|rank|filter|screen)|(?:hiring|recruitment|employment)\s*(?:decision|ai|model|automated)/gi,
        severity: 'high',
        description: 'Employment or recruitment AI decision pattern (Annex III area)'
    },
    {
        id: 'EUAI-HR-002',
        annex: 'III.5',
        category: 'high-risk',
        type: 'EU AI Act — High-Risk Indicator',
        regex: /\b(?:credit\s*score|creditworthiness|loan\s*approv|lending\s*decision|underwriting\s*model|default\s*risk\s*model)/gi,
        severity: 'high',
        description: 'Credit or lending AI decision pattern (Annex III area)'
    },
    {
        id: 'EUAI-HR-003',
        annex: 'III.1',
        category: 'high-risk',
        type: 'EU AI Act — High-Risk Indicator',
        regex: /\b(?:biometric\s*identif|facial\s*recognition|face\s*match|emotion\s*detect|gait\s*recognition)/gi,
        severity: 'high',
        description: 'Biometric identification or categorisation pattern (Annex III area)'
    },
    {
        id: 'EUAI-HR-004',
        annex: 'III.3',
        category: 'high-risk',
        type: 'EU AI Act — High-Risk Indicator',
        regex: /\b(?:exam\s*grad|student\s*assessment\s*automated|admission\s*decision\s*ai|education\s*ai\s*score)/gi,
        severity: 'high',
        description: 'Education or vocational training AI assessment pattern (Annex III area)'
    },
    {
        id: 'EUAI-HR-005',
        annex: 'III.6',
        category: 'high-risk',
        type: 'EU AI Act — High-Risk Indicator',
        regex: /\b(?:insurance\s*premium\s*ai|insurance\s*underwriting\s*model|claims\s*automated\s*decision)/gi,
        severity: 'high',
        description: 'Insurance pricing or claims AI pattern (Annex III area)'
    },
    {
        id: 'EUAI-HR-006',
        annex: 'III.7',
        category: 'high-risk',
        type: 'EU AI Act — High-Risk Indicator',
        regex: /\b(?:predictive\s*policing|criminal\s*risk\s*score|recidivism\s*model|law\s*enforcement\s*ai)/gi,
        severity: 'high',
        description: 'Law enforcement risk assessment AI pattern (Annex III area)'
    },
    {
        id: 'EUAI-HR-007',
        annex: 'III.8',
        category: 'high-risk',
        type: 'EU AI Act — High-Risk Indicator',
        regex: /\b(?:migration\s*screen|asylum\s*decision\s*ai|border\s*control\s*ai|visa\s*automated\s*decision)/gi,
        severity: 'high',
        description: 'Migration, asylum, or border control AI pattern (Annex III area)'
    }
];

const AI_SYSTEM_INDICATORS = [
    {
        id: 'EUAI-AI-001',
        category: 'ai-system',
        type: 'EU AI Act — AI System Indicator',
        regex: /\b(?:openai|anthropic|claude|gpt-[\d.o]|chatgpt|llm\.|large\s*language\s*model|generative\s*ai|text-generation|chat\.completions|embeddings\.create)/gi,
        severity: 'medium',
        description: 'Generative AI or LLM integration detected'
    },
    {
        id: 'EUAI-AI-002',
        category: 'ai-system',
        type: 'EU AI Act — AI System Indicator',
        regex: /\b(?:machine\s*learning|ml\.predict|model\.predict|inference\s*endpoint|tensorflow|pytorch|onnxruntime|huggingface)/gi,
        severity: 'medium',
        description: 'Machine learning inference or model runtime detected'
    }
];

const TRANSPARENCY_DISCLOSURE_PATTERNS = [
    /\bai[-\s]?generated\b/i,
    /\bgenerated\s+by\s+(?:an?\s+)?ai\b/i,
    /\bartificial\s+intelligence\b/i,
    /\bthis\s+(?:content|response|output)\s+(?:was|is)\s+(?:automatically\s+)?generated\b/i,
    /\byou\s+are\s+(?:chatting|interacting)\s+with\s+(?:an?\s+)?ai\b/i,
    /\bautomated\s+(?:decision|recommendation)\b/i,
    /\beu\s+ai\s+act\b/i,
    /\barticle\s+50\b/i
];

const HUMAN_OVERSIGHT_PATTERNS = [
    /\bhuman[-\s]?(?:in[-\s]the[-\s]loop|oversight|review|approval)\b/i,
    /\bmanual\s+(?:review|approval|override|intervention)\b/i,
    /\boperator\s+override\b/i,
    /\bappeal\s+(?:process|mechanism|right)\b/i,
    /\bhuman\s+supervision\b/i
];

const LOGGING_PATTERNS = [
    /\b(?:audit|decision|inference|model)\s*log(?:ger|ging)?\b/i,
    /\bai\s*audit\b/i,
    /\btrace(?:Id|_id)\b/i,
    /\blog(?:Model|Inference|Decision)(?:Event|Record)?\b/i,
    /\brecord(?:AI|Model|Inference)Decision\b/i
];

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function lineNumberAt(content, index) {
    return content.slice(0, Math.max(0, index)).split('\n').length;
}

function isExcludedPath(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    if (/(?:^|\/)src\/(?:rules|reporters|analyzers|proxy)(?:\/|$)/.test(normalized)) return true;
    if (/\/simplebeacon-cli\/src\/(?:rules|reporters|analyzers|proxy|lib)\//.test(normalized)) return true;
    if (/(?:^|\/)coming-soon\//.test(normalized)) return true;
    if (/(?:^|\/)reports\//.test(normalized)) return true;
    if (/(?:^|\/)security-reports\//.test(normalized)) return true;
    if (/(?:^|\/)templates\//.test(normalized)) return true;
    if (/(?:^|\/)data-central\//.test(normalized)) return true;
    if (/(?:^|\/)deployments\//.test(normalized)) return true;
    if (/(?:^|\/)public\//.test(normalized)) return true;
    if (/(?:^|\/)functions\//.test(normalized)) return true;
    if (/(?:^|\/)cloudflare-deploy\//.test(normalized)) return true;
    if (/(?:^|\/)archive\//.test(normalized)) return true;
    if (/(?:^|\/)temp\//.test(normalized)) return true;
    if (/(?:^|\/)tests-legacy\//.test(normalized)) return true;
    if (/(?:^|\/)downloads\//.test(normalized)) return true;
    if (/(?:^|\/)web\/(?:data|findings|simplebeacon-findings)\//.test(normalized)) return true;
    if (/(?:^|\/)web\/simplebeacon-dashboard\/js\/(?:views\/|utils\/|utils\.js$)/.test(normalized)) return true;
    if (/(?:^|\/)server\/test-gateway\.js$/.test(normalized)) return true;
    if (/(?:^|\/)simplebeacon-frameworkless\//.test(normalized)) return true;
    if (/(?:^|\/)simplebeacon-rule-tests\//.test(normalized)) return true;
    if (/(?:^|\/)node_modules\//.test(normalized)) return true;
    if (/(?:^|\/)java-ai-vulnerable\//.test(normalized)) return true;
    if (/(?:^|\/)\.gitkeep$/.test(normalized)) return true;
    if (/^delivery_\d+_[a-z0-9]+\.json$/.test(normalized)) return true;
    if (/(?:^|\/)test-output/.test(normalized)) return true;
    return false;
}

async function walkSourceFiles(baseDir, sourcePaths, results = []) {
    for (const rel of sourcePaths) {
        const abs = path.join(baseDir, ...String(rel).replace(/\/$/, '').split('/'));
        if (!fs.existsSync(abs)) continue;
        const stat = await fs.promises.stat(abs).catch(() => null);
        if (!stat) continue;
        if (stat.isFile()) {
            const ext = path.extname(abs).toLowerCase();
            if (SCANNABLE_EXTENSIONS.has(ext)) {
                results.push({ path: abs, ext });
            }
            continue;
        }
        await walkDir(abs, results);
    }
    return results;
}

async function walkDir(dir, results, depth = 0) {
    if (depth > 8) return;
    let entries;
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walkDir(fullPath, results, depth + 1);
            continue;
        }
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (SCANNABLE_EXTENSIONS.has(ext)) {
            results.push({ path: fullPath, ext });
        }
    }
}

function collapsePatternIssuesByFile(issues, relativePath) {
    if (!issues.length) return [];
    const patternId = issues[0].metadata?.patternId || issues[0].type;
    const matches = [...new Set(issues.map((i) => i.metadata?.match).filter(Boolean))];
    return [{
        ...issues[0],
        id: `${patternId}-${relativePath}`,
        filePath: relativePath,
        count: 1,
        description: issues.length > 1
            ? `${issues[0].description} (${issues.length} matches in file)`
            : issues[0].description,
        affectedFiles: [relativePath],
        metadata: {
            ...(issues[0].metadata || {}),
            matchCount: issues.length,
            matches: matches.slice(0, 8)
        }
    }];
}

const SEVERITY_RANK = Object.freeze({ low: 0, medium: 1, high: 2, critical: 3 });

/** Cap per-pattern severity at the rule-pack default from .simplebeacon/config.json */
function capIssueSeverity(issueSeverity, severityCap) {
    const capRank = SEVERITY_RANK[severityCap];
    const issueRank = SEVERITY_RANK[issueSeverity];
    if (capRank === undefined || issueRank === undefined) {
        return issueSeverity || severityCap;
    }
    return issueRank > capRank ? severityCap : (issueSeverity || severityCap);
}

function scanCatalogPatterns(relativePath, content, catalog, severityDefault) {
    const issues = [];
    for (const rule of catalog) {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(content)) !== null) {
            issues.push({
                id: `${rule.id}-${relativePath}-${match.index}`,
                severity: capIssueSeverity(rule.severity || severityDefault, severityDefault),
                type: rule.type,
                filePath: relativePath,
                count: 1,
                description: rule.description,
                recommendedAction: rule.category === 'high-risk'
                    ? 'Document Annex III classification, conduct FRIA, and implement high-risk system requirements before August 2026'
                    : 'Review EU AI Act transparency and documentation obligations for this AI integration',
                affectedFiles: [relativePath],
                metadata: {
                    patternId: rule.id,
                    category: rule.category,
                    annex: rule.annex || null,
                    match: match[0].slice(0, 80)
                }
            });
        }
    }
    return issues;
}

function hasTransparencyDisclosure(content) {
    return TRANSPARENCY_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(content));
}

function scanTransparencyGaps(relativePath, content, severityDefault) {
    const issues = [];
    const normalized = String(relativePath || '').toLowerCase().replace(/\\/g, '/');

    // Skip backend routes, services, env files, docs, and outreach templates — not user-facing AI output
    if (/\.(?:env|env\.example)$/.test(normalized)) return issues;
    if (/(?:^|\/)server\/(?:routes|services|lib)\//.test(normalized)) return issues;
    if (/(?:^|\/)packages\/simplebeacon-cli\/docs\//.test(normalized)) return issues;
    if (/(?:^|\/)outreach/.test(normalized)) return issues;

    const hasAiIndicator = AI_SYSTEM_INDICATORS.some((rule) => {
        rule.regex.lastIndex = 0;
        return rule.regex.test(content);
    });
    if (!hasAiIndicator) return issues;

    const isUiFacing = /\.(html|tsx|jsx|vue|svelte|md)$/i.test(relativePath)
        || /(?:component|page|view|ui|frontend|chat)/i.test(relativePath);
    if (!isUiFacing) return issues;

    if (!hasTransparencyDisclosure(content)) {
        issues.push({
            id: `EUAI-T50-001-${relativePath}`,
            severity: severityDefault,
            type: 'EU AI Act — Transparency Gap (Art. 50)',
            filePath: relativePath,
            count: 1,
            description: 'AI system integration in user-facing code without transparency/disclosure markers',
            recommendedAction: 'Add Article 50 disclosure — inform users they interact with AI or that content is AI-generated',
            affectedFiles: [relativePath],
            metadata: { patternId: 'EUAI-T50-001', category: 'transparency', article: '50' }
        });
    }
    return issues;
}

function scanHumanOversightGaps(relativePath, content, hasHighRiskInFile, severityDefault) {
    if (!hasHighRiskInFile) return [];
    if (HUMAN_OVERSIGHT_PATTERNS.some((pattern) => pattern.test(content))) return [];
    return [{
        id: `EUAI-HO-001-${relativePath}`,
        severity: severityDefault,
        type: 'EU AI Act — Human Oversight Gap',
        filePath: relativePath,
        count: 1,
        description: 'High-risk AI pattern without human oversight or appeal signals in same file',
        recommendedAction: 'Implement human-in-the-loop review, manual override, or appeal mechanism for high-risk AI decisions',
        affectedFiles: [relativePath],
        metadata: { patternId: 'EUAI-HO-001', category: 'human-oversight' }
    }];
}

function scanLoggingGaps(relativePath, content, hasAiInFile, severityDefault) {
    if (!hasAiInFile) return [];
    if (LOGGING_PATTERNS.some((pattern) => pattern.test(content))) return [];
    const isDecisionPath = /(?:route|controller|service|handler|api)/i.test(relativePath);
    if (!isDecisionPath) return [];
    return [{
        id: `EUAI-LOG-001-${relativePath}`,
        severity: 'low',
        type: 'EU AI Act — Logging Gap',
        filePath: relativePath,
        count: 1,
        description: 'AI decision path without audit or inference logging signals',
        recommendedAction: 'Add automatic logging of AI system inputs, outputs, and decision rationale for accountability',
        affectedFiles: [relativePath],
        metadata: { patternId: 'EUAI-LOG-001', category: 'logging' }
    }];
}

function detectDocumentationArtifacts(baseDir) {
    const found = [];
    const searchRoots = [
        baseDir,
        path.join(baseDir, 'docs'),
        path.join(baseDir, 'documentation'),
        path.join(baseDir, '.simplebeacon')
    ];

    for (const root of searchRoots) {
        if (!fs.existsSync(root)) continue;
        for (const fileName of DOCUMENTATION_FILE_NAMES) {
            const filePath = path.join(root, fileName);
            if (fs.existsSync(filePath)) {
                found.push({ id: 'file', label: fileName, path: normalizeRel(baseDir, filePath) });
            }
        }
        let entries;
        try {
            entries = fs.readdirSync(root, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            if (/\.simplebeacon-backup\./i.test(entry.name)) continue;
            const fullPath = path.join(root, entry.name);
            let content;
            try {
                if (fs.statSync(fullPath).size > MAX_SCAN_BYTES) continue;
                content = fs.readFileSync(fullPath, 'utf8');
            } catch {
                continue;
            }
            for (const marker of DOCUMENTATION_MARKERS) {
                if (marker.pattern.test(content) || marker.pattern.test(entry.name)) {
                    found.push({
                        id: marker.id,
                        label: marker.label,
                        path: normalizeRel(baseDir, fullPath)
                    });
                }
            }
        }
    }

    const unique = [];
    const seen = new Set();
    const seenPaths = new Set();
    for (const item of found) {
        const key = `${item.id}:${item.path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
    }

    const documentationFound = [];
    for (const item of unique) {
        if (seenPaths.has(item.path)) continue;
        seenPaths.add(item.path);
        documentationFound.push(item.path);
    }

    return { artifacts: unique, paths: documentationFound };
}

function hasDocumentedAiInventory(documentation) {
    const paths = documentation.paths || [];
    const hasSystemDoc = paths.some((p) => /(?:^|\/)ai-system-documentation\.md$/i.test(p));
    const hasComplianceDoc = paths.some((p) => /(?:^|\/)eu-ai-act-compliance\.md$/i.test(p));
    return hasSystemDoc && hasComplianceDoc;
}

function filterDocumentedAiInventoryIssues(issues, documentation, summary) {
    if (!hasDocumentedAiInventory(documentation)) return issues;
    if ((summary.highRiskIndicators || 0) > 0) return issues;
    if ((summary.transparencyGaps || 0) > 0) return issues;
    return issues.filter((issue) => {
        const patternId = issue.metadata?.patternId;
        return patternId !== 'EUAI-AI-001' && patternId !== 'EUAI-AI-002';
    });
}

async function scanEuAiActPatterns(baseDir, options = {}) {
    const ignoreGlobs = options.ignoreGlobs || [];
    const severityDefault = options.severity || 'medium';

    let uniqueFiles = [];
    if (Array.isArray(options.fileList) && options.fileList.length > 0) {
        uniqueFiles = options.fileList;
    } else {
        const sourcePaths = options.sourcePaths || DEFAULT_SOURCE_PATHS;
        const productionPaths = options.productionPaths || DEFAULT_PRODUCTION_PATHS;
        const files = [];
        await walkSourceFiles(baseDir, sourcePaths, files);
        for (const rel of productionPaths) {
            const abs = path.join(baseDir, ...rel.replace(/\/$/, '').split('/'));
            if (fs.existsSync(abs)) {
                await walkProductionFiles(abs, files);
            }
        }

        const seen = new Set();
        for (const file of files) {
            const key = file.path;
            if (seen.has(key)) continue;
            seen.add(key);
            uniqueFiles.push(file);
        }
    }

    const issues = [];
    let scanned = 0;
    let highRiskHits = 0;
    let aiSystemHits = 0;
    let transparencyGaps = 0;

    for (const file of uniqueFiles) {
        const relativePath = normalizeRel(baseDir, file.path);
        if (ignoreGlobs.some((g) => globMatch(relativePath, g))) continue;
        if (isExcludedPath(relativePath)) continue;

        let content;
        try {
            const stat = await fs.promises.stat(file.path);
            if (stat.size > MAX_SCAN_BYTES) continue;
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }

        scanned += 1;
        const ext = file.ext || path.extname(file.path).toLowerCase();

        const highRiskIssues = scanCatalogPatterns(relativePath, content, HIGH_RISK_CATALOG, 'high');
        const aiIssues = scanCatalogPatterns(relativePath, content, AI_SYSTEM_INDICATORS, severityDefault);
        highRiskHits += highRiskIssues.length > 0 ? 1 : 0;
        aiSystemHits += aiIssues.length > 0 ? 1 : 0;
        issues.push(...collapsePatternIssuesByFile(highRiskIssues, relativePath));
        issues.push(...collapsePatternIssuesByFile(aiIssues, relativePath));

        const transparencyIssues = scanTransparencyGaps(relativePath, content, severityDefault);
        transparencyGaps += transparencyIssues.length;
        issues.push(...transparencyIssues);

        const hasHighRisk = highRiskIssues.length > 0;
        const hasAi = aiIssues.length > 0 || hasHighRisk;
        issues.push(...scanHumanOversightGaps(relativePath, content, hasHighRisk, severityDefault));
        issues.push(...scanLoggingGaps(relativePath, content, hasAi, severityDefault));
    }

    const documentation = detectDocumentationArtifacts(baseDir);
    const filteredIssues = filterDocumentedAiInventoryIssues(issues, documentation, {
        highRiskIndicators: highRiskHits,
        transparencyGaps
    });
    const summary = {
        highRiskIndicators: highRiskHits,
        aiSystemIndicators: aiSystemHits,
        transparencyGaps,
        documentationArtifacts: documentation.artifacts.length,
        documentationFound: documentation.paths,
        deadlineNote: 'High-risk AI systems must comply with EU AI Act requirements by August 2026'
    };

    return {
        scanned,
        findings: filteredIssues.length,
        issues: filteredIssues,
        summary,
        patterns: [...HIGH_RISK_CATALOG, ...AI_SYSTEM_INDICATORS].map((r) => r.id)
    };
}

function buildEuAiActSummaryFromScan(baseDir, issues, euActStats = {}) {
    const highRiskHits = euActStats.highRiskHits ?? 0;
    const aiSystemHits = euActStats.aiSystemHits ?? 0;
    const transparencyGaps = euActStats.transparencyGaps ?? 0;

    const documentation = detectDocumentationArtifacts(baseDir);
    const filteredIssues = filterDocumentedAiInventoryIssues(issues, documentation, {
        highRiskIndicators: highRiskHits,
        transparencyGaps
    });

    return {
        highRiskIndicators: highRiskHits,
        aiSystemIndicators: aiSystemHits,
        transparencyGaps,
        documentationArtifacts: documentation.artifacts.length,
        documentationFound: documentation.paths,
        deadlineNote: 'High-risk AI systems must comply with EU AI Act requirements by August 2026'
    };
}


function scanEuAiActFileContent(relativePath, content, severityDefault = 'medium') {
    const issues = [];

    const highRiskIssues = scanCatalogPatterns(relativePath, content, HIGH_RISK_CATALOG, 'high');
    const aiIssues = scanCatalogPatterns(relativePath, content, AI_SYSTEM_INDICATORS, severityDefault);
    const highRiskHits = highRiskIssues.length > 0 ? 1 : 0;
    const aiSystemHits = aiIssues.length > 0 ? 1 : 0;

    issues.push(...collapsePatternIssuesByFile(highRiskIssues, relativePath));
    issues.push(...collapsePatternIssuesByFile(aiIssues, relativePath));

    const transparencyIssues = scanTransparencyGaps(relativePath, content, severityDefault);
    const transparencyGaps = transparencyIssues.length;
    issues.push(...transparencyIssues);

    const hasHighRisk = highRiskIssues.length > 0;
    const hasAi = aiIssues.length > 0 || hasHighRisk;
    issues.push(...scanHumanOversightGaps(relativePath, content, hasHighRisk, severityDefault));
    issues.push(...scanLoggingGaps(relativePath, content, hasAi, severityDefault));

    return { issues, highRiskHits, aiSystemHits, transparencyGaps };
}
module.exports = {
    HIGH_RISK_CATALOG,
    AI_SYSTEM_INDICATORS,
    DOCUMENTATION_MARKERS,
    DOCUMENTATION_FILE_NAMES,
    detectDocumentationArtifacts,
    scanEuAiActPatterns,
    scanEuAiActFileContent,
    hasTransparencyDisclosure,
    hasDocumentedAiInventory,
    filterDocumentedAiInventoryIssues,
    isExcludedPath,
    buildEuAiActSummaryFromScan,
    DEFAULT_SOURCE_PATHS,
    DEFAULT_PRODUCTION_PATHS
};
