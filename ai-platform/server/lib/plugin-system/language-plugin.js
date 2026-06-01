/**
 * Base language plugin — pattern-driven analysis with optional content indicators.
 */

const EMPTY_PATTERNS = { techDebt: [], debug: [], placeholders: [], bestPractices: [], productionLeak: [] };

class LanguagePlugin {
    constructor(config = {}) {
        this.id = config.id;
        this.language = config.language;
        this.label = config.label || config.language;
        this.extensions = new Set((config.extensions || []).map((ext) => String(ext).toLowerCase()));
        this.basenames = new Set((config.basenames || []).map((name) => String(name).toLowerCase()));
        this.version = config.version || '1.0.0';
        this.parser = config.parser || 'regex';
        this.patterns = config.patterns || EMPTY_PATTERNS;
        this.contentIndicators = config.contentIndicators || [];
        this.useGenericTechDebt = config.useGenericTechDebt !== false;
        this.useGenericPlaceholders = config.useGenericPlaceholders !== false;
        this.structureParser = null;
    }

    matchesExtension(extension) {
        return this.extensions.has(String(extension || '').toLowerCase());
    }

    matchesBasename(basename) {
        return this.basenames.has(String(basename || '').toLowerCase());
    }

    scoreContent(content) {
        let score = 0;
        for (const indicator of this.contentIndicators) {
            const pattern = new RegExp(indicator.pattern.source, indicator.pattern.flags);
            const matches = String(content || '').match(pattern);
            if (matches) score += (indicator.weight || 1) * Math.min(matches.length, 4);
        }
        return score;
    }

    analyze(content, relativePath, helpers = {}) {
        const findings = [];
        const {
            scanContentPatterns,
            TECH_DEBT_PATTERNS,
            detectPlaceholderAndFictionalData,
            isNonProductionAuditContentPath,
            isPlaceholderCatalogOrMetaDoc,
            isTechnicalDebtReportArtifact,
            isProductionRelevantPath,
            isCliToolingPath
        } = helpers;

        if (!scanContentPatterns) {
            return {
                language: this.language,
                pluginId: this.id,
                version: this.version,
                findings,
                structure: null
            };
        }

        const rel = relativePath;
        const skipPatternCatalogDoc = isPlaceholderCatalogOrMetaDoc?.(rel);
        if (skipPatternCatalogDoc) {
            return {
                language: this.language,
                pluginId: this.id,
                version: this.version,
                parser: this.parser,
                findings: [],
                structure: this.structureParser ? this.structureParser(content, rel) : null
            };
        }

        if (isNonProductionAuditContentPath?.(rel)) {
            return {
                language: this.language,
                pluginId: this.id,
                version: this.version,
                parser: this.parser,
                findings: [],
                structure: this.structureParser ? this.structureParser(content, rel) : null
            };
        }

        const skipTechDebt = isTechnicalDebtReportArtifact?.(rel);

        if (this.useGenericTechDebt && !skipTechDebt) {
            if (TECH_DEBT_PATTERNS) {
                findings.push(...scanContentPatterns(content, rel, TECH_DEBT_PATTERNS, 'tech-debt', 'medium'));
            }
            findings.push(...scanContentPatterns(content, rel, this.patterns.techDebt, 'tech-debt', 'medium'));
        }

        if (!isCliToolingPath?.(rel)) {
            const debugPatterns = (this.patterns.debug || []).filter((pattern) => {
                if (pattern.id === 'r-print' && this.language === 'python') return false;
                if (pattern.id === 'python-print' && this.language === 'r') return false;
                return true;
            });
            findings.push(...scanContentPatterns(content, rel, debugPatterns, 'debug-artifact', 'medium'));
        }

        if (this.patterns.productionLeak?.length) {
            const productionOnly = typeof isProductionRelevantPath === 'function'
                ? isProductionRelevantPath(rel)
                : false;
            if (productionOnly) {
                findings.push(...scanContentPatterns(
                    content,
                    rel,
                    this.patterns.productionLeak,
                    'tech-debt',
                    'high',
                    true
                ));
            }
        }

        const skipPlaceholders = isNonProductionAuditContentPath?.(rel) || isPlaceholderCatalogOrMetaDoc?.(rel);

        if (this.useGenericPlaceholders && !skipPlaceholders) {
            if (detectPlaceholderAndFictionalData) {
                findings.push(...detectPlaceholderAndFictionalData(content, rel));
            }
            findings.push(...scanContentPatterns(content, rel, this.patterns.placeholders, 'meaningless-data', 'low'));
        }

        findings.push(...scanContentPatterns(content, rel, this.patterns.bestPractices, 'tech-debt', 'low'));

        return {
            language: this.language,
            pluginId: this.id,
            version: this.version,
            parser: this.parser,
            findings,
            structure: this.structureParser ? this.structureParser(content, rel) : null
        };
    }
}

module.exports = {
    LanguagePlugin,
    EMPTY_PATTERNS
};
