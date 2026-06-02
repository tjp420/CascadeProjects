/**
 * Classify production-leak pattern matches — separate repository-audit
 * infrastructure from accidental sample paths in shipping code.
 * 
 * Supports inline intent markers for explicit false positive suppression:
 * // simplebeacon:production-leak-intent: <intent-type> - <reason>
 */

const REPOSITORY_AUDIT_INFRA_FILES = new Set([
    'sample-path-resolver.cjs',
    'snapshot-seeds.js',
    'snapshot-seeds.cjs',
    'snapshot-resolver.js',
    'snapshot-resolver.cjs',
    'mock-data-schema-validator.js',
    'mock-data-schema-validator.cjs',
    'sample-consistency-checker.js',
    'sample-consistency-checker.cjs',
    'roadmap-json-specs.js',
    'roadmap-json-specs.cjs',
    'page-sample-specs.js',
    'page-sample-specs.cjs',
    'code-roadmap-generator.cjs',
    'mock-data-scanner.js',
    'mock-data-scanner.cjs',
    'dev-tools-workflows.js',
    'dev-tools-workflows.cjs',
    'rule-catalog.js',
    'rule-catalog.cjs',
    'production-leak.js',
    'production-leak.cjs',
    'production-leak-intent.js',
    'production-leak-intent.cjs',
    'snippet-scanner.js',
    'snippet-scanner.cjs',
    'project-detect.js',
    'project-detect.cjs',
    'remediation-guides.js',
    'remediation-guides.cjs',
    'normalize-scan-report.js',
    'normalize-scan-report.cjs',
    'privacy-triage.js',
    'privacy-triage.cjs',
    'scan-conclusion.js',
    'scan-conclusion.cjs',
    'cleanup-assistant-brief.js',
    'cleanup-assistant-brief.cjs',
    'cleanup-brief-export-sanitize.js',
    'cleanup-brief-export-sanitize.cjs',
    'compliance-export-sanitize.js',
    'compliance-export-sanitize.cjs',
    'complete-scan-export-sanitize.js',
    'complete-scan-export-sanitize.cjs',
    'data-cleanup-export-sanitize.js',
    'data-cleanup-export-sanitize.cjs',
    'data-lineage-analyzer.js',
    'data-lineage-analyzer.cjs',
    'data-file-utils.js',
    'data-file-utils.cjs',
    'unused-file-detector.js',
    'unused-file-detector.cjs',
    'eu-ai-act-export.js',
    'eu-ai-act-export.cjs'
]);

const SCANNER_IMPL_PATH_RE = /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|reporters|analyzers|lib|proxy|mcp)(?:\/|$)|(?:^|\/)src\/(?:rules|reporters|analyzers|lib|proxy|mcp)(?:\/|$)/;

const OSS_SCANNER_ROOT_FILES = new Set([
    'src/scan.js',
    'src/config.js',
    'src/project-detect.js',
    'src/index.js'
]);

const REPOSITORY_AUDIT_MARKERS = [
    /repository-audit/i,
    /PAGE_SAMPLE_SPECS/,
    /resolveSampleFilePath/,
    /SAMPLE_FILE_OVERRIDES/,
    /SNAPSHOT_SEEDS/,
    /AUDIT_SAMPLE_FILES/,
    /dataSource\s*[:=]\s*['"]repository-audit['"]/
];

function normalizeRel(relativePath) {
    return String(relativePath || '').replace(/\\/g, '/');
}

function basename(relativePath) {
    const normalized = normalizeRel(relativePath);
    const parts = normalized.split('/');
    return parts[parts.length - 1] || normalized;
}

function isRepositoryAuditInfraFile(relativePath) {
    return REPOSITORY_AUDIT_INFRA_FILES.has(basename(relativePath));
}

function isScannerImplementationPath(relativePath) {
    const rel = normalizeRel(relativePath);
    if (SCANNER_IMPL_PATH_RE.test(rel.toLowerCase())) {
        return true;
    }
    if (OSS_SCANNER_ROOT_FILES.has(rel)) {
        return true;
    }
    return REPOSITORY_AUDIT_INFRA_FILES.has(basename(relativePath));
}

function fileDeclaresSimplebeaconScanner(content) {
    return /simplebeacon|SIMPLEBEACON|PAGE_SAMPLE_SPECS|production-leak|simplebeacon-mcp|LEAK_PATTERNS/.test(content || '');
}

function isScannerMetaReference(relativePath, content, line, matchText) {
    if (isAccidentalLoadPattern(line, matchText)) {
        return false;
    }
    if (isScannerImplementationPath(relativePath)) {
        return true;
    }
    const rel = normalizeRel(relativePath);
    if (/^src\/(scan|config)\.js$/.test(rel) && fileDeclaresSimplebeaconScanner(content)) {
        return true;
    }
    if (basename(relativePath) === 'rule-catalog.js') {
        return true;
    }
    return false;
}

function fileDeclaresRepositoryAudit(content) {
    return REPOSITORY_AUDIT_MARKERS.some((re) => re.test(content));
}

function fileDeclaresExportSanitizer(content) {
    return /exportSanitized|sanitize.*Export|build.*ExportNotes|securityHandoffEligible/i.test(content || '');
}

function isCatalogSampleReference(line) {
    const trimmed = String(line || '').trim();
    return /^\w[\w$-]*\s*:\s*['"`][^'"`]*-sample\.json['"`]/.test(trimmed)
        || /^\w[\w$-]*\s*:\s*['"`][^'"`]*-sample\.json['"`],?\s*$/.test(trimmed);
}

function isSampleDirConfigReference(line) {
    return /sampleDir\s*[:=]/.test(String(line || ''));
}

function isSnapshotSeedEntry(line) {
    return /\bfile\s*:\s*['"`][^'"`]*-sample\.json['"`]/.test(String(line || ''));
}

function isStubApiSampleJoin(line) {
    const text = String(line || '');
    return /path\.join\s*\([^)]*['"]data['"][^)]*-sample\.json['"]/.test(text)
        || /path\.join\s*\([^)]*-sample\.json['"]/.test(text);
}

function isStubApiLoaderFile(relativePath) {
    return /stub-api\.[cm]?js$/i.test(normalizeRel(relativePath));
}

function isPathJoinWebData(line) {
    return /join\s*\(\s*['"]web['"]\s*,\s*['"]data['"]/.test(String(line || ''));
}

const DEMO_TOOL_PATH_SEGMENTS = [
    '/example/',
    '/examples/',
    '/tools/',
    '/applets/',
    '/demos/',
    '/demo/',
    '/simplebeacon-dashboard/',
    '/coming-soon/',
    'coming-soon/',
    '/simplebeacon-frameworkless/',
    'simplebeacon-frameworkless/'
];

function isDemoToolSamplePath(relativePath) {
    const normalized = normalizeRel(relativePath).toLowerCase();
    if (/\.(test|spec)\.(jsx?|tsx?|mjs|cjs)$/.test(normalized)) {
        return true;
    }
    return DEMO_TOOL_PATH_SEGMENTS.some((segment) => normalized.includes(segment));
}

function isPlainSampleJsonMatch(matchText) {
    return /sample\.json/i.test(String(matchText || '')) && !/-sample\.json/i.test(String(matchText || ''));
}

function isAccidentalLoadPattern(line, matchText) {
    const text = String(line || '');
    if (/\brequire\s*\(/.test(text) && /-sample\.json|\/mock\/|\/fixtures\//.test(matchText)) {
        return true;
    }
    if (/\brequire\s*\(/.test(text) && isPlainSampleJsonMatch(matchText)) {
        return true;
    }
    if (/\breadFile(?:Sync)?\s*\(/.test(text) && /-sample\.json|web[/\\]data/.test(matchText)) {
        return true;
    }
    if (/\breadFile(?:Sync)?\s*\(/.test(text) && isPlainSampleJsonMatch(matchText)) {
        return true;
    }
    if (/\bfetch\s*\(/.test(text) && /-sample\.json|\/data\//.test(matchText)) {
        return true;
    }
    if (/\bfetch\s*\(/.test(text) && isPlainSampleJsonMatch(matchText)) {
        return true;
    }
    if (/\bimport\s+.*from\s+['"`].*-sample\.json/.test(text)) {
        return true;
    }
    if (/\bimport\s+.*from\s+['"`][^'"`]*sample\.json/.test(text) && isPlainSampleJsonMatch(matchText)) {
        return true;
    }
    return false;
}

function isDocumentationPath(relativePath) {
    const rel = normalizeRel(relativePath).toLowerCase();
    return /^docs\//.test(rel) || /\/docs\//.test(rel);
}

function isJsonCatalogSampleCitation(line, matchText) {
    const trimmed = String(line || '').trim();
    if (!/"path"\s*:\s*["'`][^"'`]+["'`]/.test(trimmed)) return false;
    return /-sample\.json|(?:\/|\\)fixtures(?:\/|\\)|(?:\/|\\)mock(?:\/|\\)|web(?:\/|\\)data/.test(matchText);
}

/**
 * @returns {{ intent: string, suppress: boolean, severityBand?: string, reason: string }}
 */
function classifyProductionLeakMatch({
    relativePath,
    content,
    lineIndex,
    matchText,
    patternId
}) {
    const line = (content || '').split('\n')[lineIndex] || '';
    const rel = normalizeRel(relativePath);

    // Check for inline intent marker on the same line or previous line
    const intentMarkerPattern = /simplebeacon:production-leak-intent:\s*(\S+)\s*-\s*(.+)/;
    const lineMatch = line.match(intentMarkerPattern);
    const prevLine = lineIndex > 0 ? (content || '').split('\n')[lineIndex - 1] : '';
    const prevLineMatch = prevLine.match(intentMarkerPattern);
    
    if (lineMatch || prevLineMatch) {
        const match = lineMatch || prevLineMatch;
        return {
            intent: match[1],
            suppress: true,
            reason: `Explicit intent marker: ${match[2].trim()}`
        };
    }

    if (/simplebeacon-rule-tests\//.test(rel)) {
        return {
            intent: 'test-negative-case',
            suppress: true,
            reason: 'Intentional negative test fixture — fake credentials used for scanner validation'
        };
    }

    if (/\.github-sync\//.test(rel) || /\/github-cache\//.test(rel)) {
        return {
            intent: 'scanner-mirror',
            suppress: true,
            reason: 'Scanner code mirror or cache — not production code'
        };
    }

    if (isDocumentationPath(rel) && !isAccidentalLoadPattern(line, matchText)) {
        return {
            intent: 'documentation-metadata',
            suppress: true,
            reason: 'Documentation or codemap metadata — cited sample/fixture paths are not runtime loads'
        };
    }

    if (/^docs\/(?:archive|codemap)(?:\/|$)/i.test(rel) || /\/docs\/(?:archive|codemap)(?:\/|$)/i.test(rel)) {
        return {
            intent: 'documentation-archive',
            suppress: true,
            reason: 'Historical documentation or codemap artifact — not production-bound code'
        };
    }

    if (isJsonCatalogSampleCitation(line, matchText) && !isAccidentalLoadPattern(line, matchText)) {
        return {
            intent: 'json-catalog-metadata',
            suppress: true,
            reason: 'JSON catalog entry listing sample/dashboard artifact paths'
        };
    }

    if (/^\.github-sync\//.test(rel) || rel.includes('/.github-sync/')) {
        return {
            intent: 'github-sync-mirror',
            suppress: true,
            reason: 'Path under .github-sync/ — published CLI mirror, not ai-platform production source'
        };
    }

    if (/README\.md$/i.test(basename(relativePath)) && /\|\s*Mock paths in prod code\s*\|/.test(content || '')) {
        return {
            intent: 'documentation-example',
            suppress: true,
            reason: 'README documentation table illustrating mock-path anti-patterns'
        };
    }

    if (/simplebeacon-mcp\.js$/i.test(basename(relativePath)) && /runSmokeTest|scan_snippet/.test(content || '')) {
        return {
            intent: 'mcp-smoke-test',
            suppress: true,
            reason: 'MCP smoke test uses intentional sample-json snippet — not production runtime'
        };
    }

    if (isDemoToolSamplePath(rel)) {
        return {
            intent: 'demo-tool-sample',
            suppress: true,
            reason: 'Demo/example/tool applet path — intentional sample content'
        };
    }

    if (isScannerMetaReference(rel, content, line, matchText)) {
        return {
            intent: 'scanner-meta',
            suppress: true,
            reason: 'SimpleBeacon scanner implementation (rule engine metadata)'
        };
    }

    if (isRepositoryAuditInfraFile(rel)) {
        if (isSnapshotSeedEntry(line) || isPathJoinWebData(line) || isCatalogSampleReference(line)) {
            return {
                intent: 'repository-audit-loader',
                suppress: true,
                reason: 'Repository-audit seed/resolver catalog'
            };
        }
        if (fileDeclaresRepositoryAudit(content) && !isAccidentalLoadPattern(line, matchText)) {
            return {
                intent: 'repository-audit-loader',
                suppress: true,
                reason: 'Repository-audit infrastructure module'
            };
        }
        if (fileDeclaresExportSanitizer(content) && !isAccidentalLoadPattern(line, matchText)) {
            return {
                intent: 'export-sanitizer-metadata',
                suppress: true,
                reason: 'Export sanitizer module — sample-path prose is operator-facing metadata'
            };
        }
    }

    if (isCatalogSampleReference(line)) {
        return {
            intent: 'config-metadata',
            suppress: true,
            reason: 'Sample filename catalog entry (not a runtime load)'
        };
    }

    if (isSampleDirConfigReference(line)) {
        return {
            intent: 'config-metadata',
            suppress: true,
            reason: 'sampleDir configuration reference'
        };
    }

    if (isStubApiLoaderFile(rel) && isStubApiSampleJoin(line)) {
        return {
            intent: 'repository-audit-stub-loader',
            suppress: true,
            reason: 'Dashboard stub API loads repository-audit page samples via path.join'
        };
    }

    if (isPathJoinWebData(line)) {
        return {
            intent: 'repository-audit-loader',
            suppress: true,
            reason: 'web/data path join helper'
        };
    }

    if (fileDeclaresRepositoryAudit(content) && isCatalogSampleReference(line)) {
        return {
            intent: 'repository-audit-loader',
            suppress: true,
            reason: 'Catalog inside repository-audit module'
        };
    }

    if (isAccidentalLoadPattern(line, matchText)) {
        return {
            intent: 'accidental-leak',
            suppress: false,
            severityBand: patternId === 'sample-json' || patternId === 'web-data-sample'
                ? 'critical'
                : patternId === 'plain-sample-json'
                    ? 'high'
                    : 'high',
            reason: 'Runtime load of mock/sample path'
        };
    }

    return {
        intent: 'unclassified',
        suppress: false,
        reason: 'Mock/sample path reference in production-eligible code'
    };
}

module.exports = {
    REPOSITORY_AUDIT_INFRA_FILES,
    classifyProductionLeakMatch,
    isRepositoryAuditInfraFile,
    isScannerImplementationPath,
    isCatalogSampleReference,
    isAccidentalLoadPattern,
    isDemoToolSamplePath,
    isPlainSampleJsonMatch,
    isDocumentationPath,
    isJsonCatalogSampleCitation
};
