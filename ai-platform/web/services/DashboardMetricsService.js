/**
 * DashboardMetricsService — live KPI fetches for dashboard components.
 *
 * API mapping (gguf-dashboard-server :54355):
 * - getOpenIssuesCount()
 *     1. GET /api/issues → total | openIssueCount | open issues.length
 *     2. GET /api/gguf/issues → total (open issues)
 *     3. GET /api/backlog → items.length (TODO/FIXME markers)
 * - getAIConfidence()
 *     1. GET /api/ai-analysis → data.modelInfo.confidence | data.overview.confidence
 *     2. GET /api/gguf/analysis → analysisOverview.aiConfidence | modelInfo.confidence
 *     3. POST /api/models/active/analyze → report.analysisOverview.aiConfidence
 * - getFeatureCount()
 *     1. GET /api/feature-backlog/statistics → totalFeatures
 *     2. GET /api/roadmap/data?type=gguf → data.projectOverview.totalFeatures
 *     3. GET /api/project-structure → Object.keys(files).length (file inventory proxy)
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DashboardMetricsService = factory().DashboardMetricsService;
        root.DashboardMetricsParsers = factory().parsers;
        root.formatDashboardKpi = factory().formatDashboardKpi;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function dashboardMetricsFactory() {
    'use strict';

    const ISSUES_URL = '/api/issues';
    const GGUF_ISSUES_URL = '/api/gguf/issues?status=open';
    const BACKLOG_URL = '/api/backlog';
    const AI_ANALYSIS_URL = '/api/ai-analysis';
    const GGUF_ANALYSIS_URL = '/api/gguf/analysis';
    const MODEL_ANALYZE_URL = '/api/models/active/analyze';
    const FEATURE_STATS_URL = '/api/feature-backlog/statistics';
    const ROADMAP_URL = '/api/roadmap/data?type=gguf';
    const PROJECT_STRUCTURE_URL = '/api/project-structure';
    const SECURITY_STATUS_URL = '/api/security/status';
    const PERFORMANCE_URL = '/api/performance';
    const COVERAGE_OVERVIEW_URL = '/api/coverage-reports/overview';
    const BILLING_OVERVIEW_URL = '/api/billing-system/overview';
    const QUALITY_METRICS_URL = '/api/quality/metrics';

    function buildAuthHeaders(extraHeaders) {
        const headers = { Accept: 'application/json', ...(extraHeaders || {}) };
        try {
            const token = typeof localStorage !== 'undefined'
                ? localStorage.getItem('authToken') || localStorage.getItem('token')
                : null;
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
        } catch (_err) {
            /* ignore storage access errors */
        }
        return headers;
    }

    function metricResult(value, source, error) {
        return {
            value: value == null ? null : value,
            source: source || null,
            error: error || null,
            loaded: true
        };
    }

    function loadingMetric() {
        return { value: null, source: null, error: null, loaded: false };
    }

    function parseNumeric(value) {
        if (value == null || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    function normalizeConfidence(value) {
        const num = parseNumeric(value);
        if (num == null) return null;
        if (num > 0 && num <= 1) return Math.round(num * 1000) / 10;
        return num;
    }

    function parseOpenIssuesFromIssuesPayload(payload) {
        if (!payload || typeof payload !== 'object') return null;
        const openCount = parseNumeric(payload.openIssueCount);
        if (openCount != null) return openCount;
        const total = parseNumeric(payload.total);
        if (total != null) return total;
        const issues = payload.issues || payload.data?.issues;
        if (Array.isArray(issues)) {
            const open = issues.filter((issue) => {
                const status = String(issue.status || '').toLowerCase();
                return !status || status === 'open' || status === 'pending';
            });
            return open.length;
        }
        return null;
    }

    function parseOpenIssuesFromGgufIssues(payload) {
        if (!payload || typeof payload !== 'object') return null;
        const total = parseNumeric(payload.total);
        if (total != null) return total;
        const issues = payload.issues;
        if (Array.isArray(issues)) return issues.length;
        return null;
    }

    function parseOpenIssuesFromBacklog(payload) {
        if (!payload) return null;
        const items = Array.isArray(payload) ? payload : (payload.items || []);
        return items.length;
    }

    function parseAIConfidenceFromAiAnalysis(payload) {
        const data = payload?.data || payload;
        if (!data || typeof data !== 'object') return null;
        return normalizeConfidence(
            data.modelInfo?.confidence
            ?? data.overview?.confidence
            ?? data.overview?.aiConfidence
        );
    }

    function parseAIConfidenceFromGgufAnalysis(payload) {
        const body = payload?.analysisOverview ? payload : (payload?.data || payload);
        if (!body || typeof body !== 'object') return null;
        return normalizeConfidence(
            body.analysisOverview?.aiConfidence
            ?? body.modelInfo?.confidence
        );
    }

    function parseAIConfidenceFromAnalyze(payload) {
        const report = payload?.report || payload?.data?.report || payload;
        return parseAIConfidenceFromGgufAnalysis(report);
    }

    function parseFeatureBacklogStats(payload) {
        const stats = payload?.featureStatistics || payload?.data?.featureStatistics || payload;
        if (!stats || typeof stats !== 'object') return null;
        const total = parseNumeric(stats.totalFeatures);
        const completed = parseNumeric(stats.completedFeatures);
        return {
            totalFeatures: total,
            completedFeatures: completed,
            pendingFeatures: parseNumeric(stats.pendingFeatures),
            completionRate: stats.completionRate || (total != null && completed != null && total > 0
                ? `${Math.round((completed / total) * 100)}%`
                : null)
        };
    }

    function parseFeatureCountFromBacklogStats(payload) {
        const parsed = parseFeatureBacklogStats(payload);
        return parsed ? parsed.totalFeatures : null;
    }

    function parsePerformanceSummary(payload) {
        if (!payload || typeof payload !== 'object') return null;
        return {
            avgResponseTime: parseNumeric(payload.avgResponseTime),
            throughput: parseNumeric(payload.throughput),
            errorRate: parseNumeric(payload.errorRate),
            requestsPerMinute: parseNumeric(payload.requestsPerMinute)
        };
    }

    function parseCoverageOverview(payload) {
        const o = payload?.overview || payload?.data?.overview || payload;
        if (!o || typeof o !== 'object') return null;
        return {
            overallCoverage: parseNumeric(o.overallCoverage ?? o.lineCoverage),
            totalTests: parseNumeric(o.totalTests),
            testPassRate: parseNumeric(o.testPassRate),
            branchCoverage: parseNumeric(o.branchCoverage)
        };
    }

    function parseBillingOverview(payload) {
        const o = payload?.overview || payload?.data?.overview || payload;
        if (!o || typeof o !== 'object') return null;
        return {
            monthlyRevenue: parseNumeric(o.monthlyRevenue),
            activeSubscriptions: parseNumeric(o.activeSubscriptions ?? o.totalCustomers),
            paymentSuccessRate: parseNumeric(o.paymentSuccessRate),
            avgRevenuePerCustomer: parseNumeric(o.avgRevenuePerCustomer)
        };
    }

    function parseQualityMetrics(payload) {
        const body = payload?.data || payload;
        if (!body || typeof body !== 'object') return null;
        return {
            healthScore: parseNumeric(body.healthScore ?? body.overallHealth ?? body.score),
            issuesDetected: parseNumeric(body.issuesDetected ?? body.totalIssues),
            filesAnalyzed: parseNumeric(body.filesAnalyzed ?? body.totalFiles),
            complexityScore: parseNumeric(body.complexityScore ?? body.averageComplexity)
        };
    }

    function parseFeatureCountFromRoadmap(payload) {
        const data = payload?.data || payload;
        return parseNumeric(data?.projectOverview?.totalFeatures);
    }

    function parseFeatureCountFromProjectStructure(payload) {
        const files = payload?.files;
        if (!files || typeof files !== 'object') return null;
        return Object.keys(files).length;
    }

    function parseGgufAnalysis(payload) {
        const body = payload?.analysisOverview ? payload : (payload?.data || payload);
        if (!body || typeof body !== 'object') return null;
        const overview = body.analysisOverview || {};
        const model = body.modelInfo || {};
        return {
            activeModels: parseNumeric(model.activeModels ?? model.modelsRunning ?? overview.activeModels),
            modelStorage: model.size || model.totalSize || overview.totalModelStorage || null,
            responseTimeMs: parseNumeric(model.responseTimeMs ?? overview.averageResponseTime),
            accuracy: normalizeConfidence(
                overview.aiConfidence ?? model.confidence ?? overview.dataQualityScore
            ),
            totalMockFiles: parseNumeric(overview.totalMockFiles),
            totalMockDataSize: overview.totalMockDataSize || overview.mockDataSize || null,
            dataQualityScore: normalizeConfidence(overview.dataQualityScore),
            issuesDetected: parseNumeric(overview.issuesDetected)
        };
    }

    function parseSecurityStatus(payload) {
        if (!payload || typeof payload !== 'object') return null;
        const vulns = payload.vulnerabilities;
        const vulnCount = Array.isArray(vulns)
            ? vulns.length
            : parseNumeric(vulns);
        return {
            securityScore: parseNumeric(payload.securityScore ?? payload.metrics?.securityScore),
            vulnerabilities: vulnCount,
            securityEvents: parseNumeric(payload.securityEvents ?? payload.metrics?.securityEvents),
            complianceRate: normalizeConfidence(
                payload.complianceRate ?? payload.metrics?.complianceRate
            )
        };
    }

    function formatDashboardKpi(metric, options) {
        const opts = options || {};
        const nullLabel = opts.nullLabel != null ? opts.nullLabel : '—';
        const errorLabel = opts.errorLabel != null ? opts.errorLabel : 'Unavailable';
        const suffix = opts.suffix || '';

        if (!metric || metric.loaded === false) return nullLabel;
        if (metric.error && metric.value == null) return errorLabel;
        if (metric.value == null) return nullLabel;
        return `${metric.value}${suffix}`;
    }

    class DashboardMetricsService {
        constructor(options) {
            const opts = options || {};
            this.fetchFn = opts.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
        }

        async fetchJson(url, options) {
            if (!this.fetchFn) {
                throw new Error('fetch is not available');
            }
            const init = {
                method: (options && options.method) || 'GET',
                headers: buildAuthHeaders(options && options.headers),
                ...(options || {})
            };
            if (init.body && typeof init.body === 'object' && !(init.body instanceof FormData)) {
                init.headers['Content-Type'] = 'application/json';
                init.body = JSON.stringify(init.body);
            }
            const response = await this.fetchFn(url, init);
            if (!response.ok) {
                throw new Error(`${init.method} ${url} failed (${response.status})`);
            }
            return response.json();
        }

        async trySources(sources) {
            const errors = [];
            for (const source of sources) {
                try {
                    const payload = await this.fetchJson(source.url, source.options);
                    const value = source.parse(payload);
                    if (value != null) {
                        return metricResult(value, source.name, null);
                    }
                    errors.push(`${source.name}: no numeric value in response`);
                } catch (error) {
                    errors.push(`${source.name}: ${error.message}`);
                }
            }
            return metricResult(null, null, errors.join('; '));
        }

        async getOpenIssuesCount() {
            return this.trySources([
                { name: '/api/issues', url: ISSUES_URL, parse: parseOpenIssuesFromIssuesPayload },
                { name: '/api/gguf/issues', url: GGUF_ISSUES_URL, parse: parseOpenIssuesFromGgufIssues },
                { name: '/api/backlog', url: BACKLOG_URL, parse: parseOpenIssuesFromBacklog }
            ]);
        }

        async getAIConfidence() {
            return this.trySources([
                { name: '/api/ai-analysis', url: AI_ANALYSIS_URL, parse: parseAIConfidenceFromAiAnalysis },
                { name: '/api/gguf/analysis', url: GGUF_ANALYSIS_URL, parse: parseAIConfidenceFromGgufAnalysis },
                {
                    name: 'POST /api/models/active/analyze',
                    url: MODEL_ANALYZE_URL,
                    options: { method: 'POST', body: {} },
                    parse: parseAIConfidenceFromAnalyze
                }
            ]);
        }

        async getFeatureCount() {
            return this.trySources([
                { name: '/api/feature-backlog/statistics', url: FEATURE_STATS_URL, parse: parseFeatureCountFromBacklogStats },
                { name: '/api/roadmap/data?type=gguf', url: ROADMAP_URL, parse: parseFeatureCountFromRoadmap },
                { name: '/api/project-structure', url: PROJECT_STRUCTURE_URL, parse: parseFeatureCountFromProjectStructure }
            ]);
        }

        async getGgufAnalysis() {
            try {
                const payload = await this.fetchJson(GGUF_ANALYSIS_URL);
                const parsed = parseGgufAnalysis(payload);
                if (!parsed) {
                    return metricResult(null, GGUF_ANALYSIS_URL, 'no values in GGUF analysis response');
                }
                return metricResult(parsed, GGUF_ANALYSIS_URL, null);
            } catch (error) {
                return metricResult(null, null, error.message);
            }
        }

        async getFeatureBacklogStatistics() {
            try {
                const payload = await this.fetchJson(FEATURE_STATS_URL);
                const parsed = parseFeatureBacklogStats(payload);
                if (!parsed) {
                    return metricResult(null, FEATURE_STATS_URL, 'no feature statistics in response');
                }
                return metricResult(parsed, FEATURE_STATS_URL, null);
            } catch (error) {
                return metricResult(null, null, error.message);
            }
        }

        async getPerformanceSummary() {
            try {
                const payload = await this.fetchJson(PERFORMANCE_URL);
                const parsed = parsePerformanceSummary(payload);
                if (!parsed) {
                    return metricResult(null, PERFORMANCE_URL, 'no performance summary in response');
                }
                return metricResult(parsed, PERFORMANCE_URL, null);
            } catch (error) {
                return metricResult(null, null, error.message);
            }
        }

        async getCoverageOverview() {
            try {
                const payload = await this.fetchJson(COVERAGE_OVERVIEW_URL);
                const parsed = parseCoverageOverview(payload);
                if (!parsed) {
                    return metricResult(null, COVERAGE_OVERVIEW_URL, 'no coverage overview in response');
                }
                return metricResult(parsed, COVERAGE_OVERVIEW_URL, null);
            } catch (error) {
                return metricResult(null, null, error.message);
            }
        }

        async getBillingOverview() {
            try {
                const payload = await this.fetchJson(BILLING_OVERVIEW_URL);
                const parsed = parseBillingOverview(payload);
                if (!parsed) {
                    return metricResult(null, BILLING_OVERVIEW_URL, 'no billing overview in response');
                }
                return metricResult(parsed, BILLING_OVERVIEW_URL, null);
            } catch (error) {
                return metricResult(null, null, error.message);
            }
        }

        async getQualityMetrics() {
            try {
                const payload = await this.fetchJson(QUALITY_METRICS_URL);
                const parsed = parseQualityMetrics(payload);
                if (!parsed) {
                    return metricResult(null, QUALITY_METRICS_URL, 'no quality metrics in response');
                }
                return metricResult(parsed, QUALITY_METRICS_URL, null);
            } catch (error) {
                return metricResult(null, null, error.message);
            }
        }

        async getSecurityMetrics() {
            try {
                const payload = await this.fetchJson(SECURITY_STATUS_URL);
                const parsed = parseSecurityStatus(payload);
                if (!parsed) {
                    return metricResult(null, SECURITY_STATUS_URL, 'no values in security status response');
                }
                return metricResult(parsed, SECURITY_STATUS_URL, null);
            } catch (error) {
                return metricResult(null, null, error.message);
            }
        }

        async getAllMetrics() {
            const [
                openIssues,
                aiConfidence,
                featureCount,
                ggufAnalysis,
                security,
                featureBacklog,
                performance,
                coverage,
                billing,
                quality
            ] = await Promise.all([
                this.getOpenIssuesCount(),
                this.getAIConfidence(),
                this.getFeatureCount(),
                this.getGgufAnalysis(),
                this.getSecurityMetrics(),
                this.getFeatureBacklogStatistics(),
                this.getPerformanceSummary(),
                this.getCoverageOverview(),
                this.getBillingOverview(),
                this.getQualityMetrics()
            ]);
            return {
                openIssues,
                aiConfidence,
                featureCount,
                ggufAnalysis,
                security,
                featureBacklog,
                performance,
                coverage,
                billing,
                quality
            };
        }
    }

    return {
        DashboardMetricsService,
        formatDashboardKpi,
        loadingMetric,
        parsers: {
            parseOpenIssuesFromIssuesPayload,
            parseOpenIssuesFromGgufIssues,
            parseOpenIssuesFromBacklog,
            parseAIConfidenceFromAiAnalysis,
            parseAIConfidenceFromGgufAnalysis,
            parseAIConfidenceFromAnalyze,
            parseFeatureCountFromBacklogStats,
            parseFeatureBacklogStats,
            parseFeatureCountFromRoadmap,
            parseFeatureCountFromProjectStructure,
            parsePerformanceSummary,
            parseCoverageOverview,
            parseBillingOverview,
            parseQualityMetrics,
            parseGgufAnalysis,
            parseSecurityStatus,
            normalizeConfidence
        }
    };
}));
