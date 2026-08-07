// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Transform scan JSON (+ optional assessment JSON) into client-facing markdown
 * matching docs/SAMPLE_REPORT.md structure.
 */

const { evaluateComplianceChecklist } = require('../compliance-checklist');
const {
    buildHowToFixSection,
    buildPersonalizedActionPlan
} = require('./remediation-guides');
const { enrichFindingsWithAlerts } = require('./alert-templates');

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const AUDIT_CHECKLIST_ROWS = [
    { check: 'zero-credential-findings', title: 'Zero hardcoded credential patterns' },
    { check: 'zero-production-leaks', title: 'Production path separation' },
    { check: 'schema-compliance', title: 'Schema conformity (configured samples)' },
    { check: 'consistency-pass', title: 'Fiction KPI baseline (sample JSON)' }
];

const CHECK_ID_MAP = {
    'CRED-001': 'zero-credential-findings',
    'LEAK-001': 'zero-production-leaks',
    'DATA-001': 'schema-compliance',
    'DATA-002': 'consistency-pass'
};

function issueSeverityBand(issue) {
    const band = String(issue.severityBand || issue.severity || 'low').toLowerCase();
    if (band === 'critical' || band === 'high' || band === 'medium' || band === 'low') {
        return band;
    }
    return 'low';
}

function normalizeIssue(issue) {
    const filePath = issue.filePath
        || issue.file
        || issue.filePaths?.[0]
        || issue.affectedFiles?.[0]
        || '—';

    return {
        ...issue,
        severity: issueSeverityBand(issue),
        filePath: String(filePath).replace(/\\/g, '/'),
        line: issue.line || issue.metadata?.line || null,
        pattern: issue.pattern || issue.metadata?.patternId || null,
        snippet: issue.metadata?.snippet || issue.snippet || null,
        recommendedAction: issue.recommendedAction || issue.recommendation || null
    };
}

function collectIssues(report) {
    const raw = report.rawIssues || report.detectedIssues || report.issues || [];
    const enriched = enrichFindingsWithAlerts(Array.isArray(raw) ? raw : []);
    return enriched.map(normalizeIssue);
}

function resolveSeverityCounts(report, issues) {
    const fromReport = report.severityCounts;
    if (fromReport && typeof fromReport === 'object') {
        return {
            critical: fromReport.critical || 0,
            high: fromReport.high || 0,
            medium: fromReport.medium || 0,
            low: fromReport.low || 0
        };
    }

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const issue of issues) {
        counts[issue.severity] += issue.count || 1;
    }
    return counts;
}

function sortIssuesBySeverity(issues) {
    return [...issues].sort((a, b) => {
        const left = SEVERITY_ORDER[a.severity] ?? 9;
        const right = SEVERITY_ORDER[b.severity] ?? 9;
        if (left !== right) return left - right;
        return String(a.filePath).localeCompare(String(b.filePath));
    });
}

function capitalize(value) {
    const s = String(value ?? '');
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatReportDate(iso) {
    const date = iso ? new Date(iso) : new Date();
    if (Number.isNaN(date.getTime())) {
        return new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ── Utility Helpers ─────────────────────────────────────────────

function pluralize(count, singular, plural) {
    const n = Number(count);
    if (!Number.isFinite(n)) return `${count} ${singular}`;
    const word = n === 1 ? singular : (plural ?? `${singular}s`);
    return `${n} ${word}`;
}

function formatNumber(n) {
    if (n == null) return '—';
    const numeric = Number(n);
    if (!Number.isFinite(numeric)) return '—';
    return numeric.toLocaleString();
}

function truncate(str, maxLen = 80, suffix = '…') {
    const s = String(str ?? '');
    const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 80;
    if (s.length <= limit) return s;
    const endLen = Math.max(0, limit - String(suffix ?? '…').length);
    return s.slice(0, endLen) + String(suffix ?? '…');
}

function isBlank(value) {
    return value == null || (typeof value === 'string' && value.trim().length === 0);
}

function noop() { /* intentionally empty */ }

function escapeRegExp(str) {
    return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(val, min, max) {
    const num = Number(val);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return NaN;
    return Number.isFinite(num) ? Math.min(Math.max(num, min), max) : min;
}

function hash(str) {
    const s = String(str ?? '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return h >>> 0;
}

function assertNever(value, message = 'Unexpected value') {
    const display = typeof value === 'string' ? value : (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
    throw new Error(`${message}: ${display}`);
}

function sleep(ms) {
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    return new Promise(resolve => setTimeout(resolve, delay));
}

function parseJsonSafe(text, fallback = null) {
    if (text == null) return fallback;
    try {
        return JSON.parse(String(text));
    } catch {
        return fallback;
    }
}

function tryFn(fn, ...args) {
    try {
        return { ok: true, value: fn.apply(this, args) };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
}

function memoize(fn, maxSize = 1000) {
    if (typeof fn !== 'function') throw new TypeError('memoize requires a function');
    const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 1000;
    const cache = new Map();
    const memoized = function (...args) {
        let key;
        try {
            key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
        } catch {
            return fn.apply(this, args);
        }
        if (cache.has(key)) {
            const value = cache.get(key);
            cache.delete(key);
            cache.set(key, value);
            return value;
        }
        const result = fn.apply(this, args);
        cache.set(key, result);
        if (cache.size > limit) {
            const oldest = cache.keys().next().value;
            if (oldest) cache.delete(oldest);
        }
        return result;
    };
    memoized.clear = () => cache.clear();
    Object.defineProperty(memoized, 'size', { get: () => cache.size });
    memoized.has = (...args) => {
        try {
            const key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
            return cache.has(key);
        } catch {
            return false;
        }
    };
    return memoized;
}

function randomId(length = 8) {
    const len = Math.max(1, Math.floor(Number(length) || 8));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const max = chars.length;
    let id = '';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint32Array(len);
        crypto.getRandomValues(arr);
        for (let i = 0; i < len; i++) id += chars[arr[i] % max];
    } else {
        for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * max)];
    }
    return id;
}

function isEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
    if (value instanceof Map || value instanceof Set) return value.size === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

function ensureArray(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    return [value];
}

function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size) return false;
        for (const [k, v] of a) {
            if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
        }
        return true;
    }
    if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size) return false;
        for (const v of a) {
            let found = false;
            for (const w of b) {
                if (deepEqual(v, w)) { found = true; break; }
            }
            if (!found) return false;
        }
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
}

function sortBy(arr, keyFn, order = 'asc') {
    if (!Array.isArray(arr)) return [];
    if (typeof keyFn !== 'function') return [...arr];
    const sorted = [...arr];
    const dir = order === 'desc' ? -1 : 1;
    sorted.sort((a, b) => {
        const ka = keyFn(a);
        const kb = keyFn(b);
        if (ka === kb || (ka == null && kb == null)) return 0;
        if (ka == null) return dir;
        if (kb == null) return -dir;
        if (typeof ka === 'number' && typeof kb === 'number') return (ka - kb) * dir;
        if (ka instanceof Date && kb instanceof Date) return (ka.getTime() - kb.getTime()) * dir;
        return String(ka).localeCompare(String(kb)) * dir;
    });
    return sorted;
}

function flatten(arr) {
    const result = [];
    if (!Array.isArray(arr)) return result;
    for (const item of arr) {
        if (Array.isArray(item)) {
            result.push(...flatten(item));
        } else {
            result.push(item);
        }
    }
    return result;
}

function range(start, end, step = 1) {
    const s = end === undefined ? 0 : start;
    const e = end === undefined ? start : end;
    if (step === 0 || !Number.isFinite(step) || !Number.isFinite(s) || !Number.isFinite(e)) return [];
    const result = [];
    if (step > 0) {
        for (let i = s; i < e; i += step) result.push(i);
    } else {
        for (let i = s; i > e; i += step) result.push(i);
    }
    return result;
}

function unique(arr, keyFn) {
    if (!Array.isArray(arr)) return [];
    if (!keyFn || typeof keyFn !== 'function') {
        return [...new Set(arr)];
    }
    const seen = new Set();
    return arr.filter((item) => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function partition(arr, predicate) {
    const pass = [];
    const fail = [];
    if (!Array.isArray(arr) || typeof predicate !== 'function') return [pass, fail];
    for (const item of arr) {
        if (predicate(item)) {
            pass.push(item);
        } else {
            fail.push(item);
        }
    }
    return [pass, fail];
}

function chunk(arr, size) {
    if (!Array.isArray(arr)) return [];
    const chunkSize = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}

function times(n, fn) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    const result = [];
    for (let i = 0; i < count; i++) result.push(fn(i));
    return result;
}

function delay(ms) {
    return sleep(ms);
}

function get(obj, path, fallback) {
    if (!obj || typeof obj !== 'object' || typeof path !== 'string') return fallback;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current == null || typeof current !== 'object') return fallback;
        current = current[key];
    }
    return current === undefined ? fallback : current;
}

function set(obj, path, value) {
    if (!obj || typeof obj !== 'object' || typeof path !== 'string') return obj;
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] == null || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
}

function seq(...fns) {
    return (value) => fns.reduce((v, fn) => fn(v), value);
}

function kebabCase(str) {
    return String(str ?? '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}

function camelCase(str) {
    return String(str ?? '')
        .replace(/[-_\s]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ''))
        .replace(/^[A-Z]/, (ch) => ch.toLowerCase());
}

function snakeCase(str) {
    return String(str ?? '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

function padStart(str, len, char = ' ') {
    const s = String(str);
    const targetLen = Math.max(0, Math.floor(Number(len) || 0));
    const padChar = String(char || ' ').slice(0, 1);
    if (s.length >= targetLen) return s;
    const pad = padChar.repeat(targetLen - s.length);
    return pad + s;
}

function padEnd(str, len, char = ' ') {
    const s = String(str);
    const targetLen = Math.max(0, Math.floor(Number(len) || 0));
    const padChar = String(char || ' ').slice(0, 1);
    if (s.length >= targetLen) return s;
    const pad = padChar.repeat(targetLen - s.length);
    return s + pad;
}

function defaults(target, ...sources) {
    if (!target || typeof target !== 'object') return {};
    const result = { ...target };
    for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        for (const key of Object.keys(src)) {
            if (!(key in result)) result[key] = src[key];
        }
    }
    return result;
}

function merge(target, ...sources) {
    if (!target || typeof target !== 'object') return {};
    const result = { ...target };
    for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        for (const key of Object.keys(src)) {
            const val = src[key];
            if (val && typeof val === 'object' && !Array.isArray(val) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
                result[key] = merge(result[key], val);
            } else {
                result[key] = val;
            }
        }
    }
    return result;
}

function intersection(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return [];
    const setB = new Set(b);
    return a.filter(item => setB.has(item));
}

function difference(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return Array.isArray(a) ? [...a] : [];
    const setB = new Set(b);
    return a.filter(item => !setB.has(item));
}

function randomChoice(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

function has(obj, key) {
    return obj != null && typeof obj === 'object' && Object.hasOwn(obj, key);
}

function zipObject(keys, values) {
    if (!Array.isArray(keys)) return {};
    const result = {};
    for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = i < (values || []).length ? values[i] : undefined;
    }
    return result;
}

function identity(value) {
    return value;
}

function constant(value) {
    return () => value;
}

function random(min, max, floating) {
    const lo = min === undefined ? 0 : Number(min) || 0;
    const hi = max === undefined ? 1 : Number(max) || 1;
    const r = Math.random() * (hi - lo) + lo;
    return floating ? r : Math.floor(r);
}

function formatGateResult(gate) {
    if (!gate) {
        return '**Not evaluated** — re-run scan with `--gate`';
    }
    return gate.pass
        ? '**PASS** — no blocking issues at configured severities'
        : '**FAIL** — action required before production deployment';
}

function formatFileLocation(issue) {
    const location = `\`${issue.filePath}\``;
    return issue.line ? `${location} (line ${issue.line})` : location;
}

function findingTitle(issue) {
    if (issue.alertTemplate?.title) return issue.alertTemplate.title;
    const type = String(issue.type || '');
    const pattern = issue.pattern;

    if (/credential/i.test(type)) {
        if (pattern === 'aws-access-key') return 'Hardcoded AWS access key pattern';
        return 'Hardcoded credential pattern';
    }
    if (/production leak/i.test(type)) return 'Production code references mock sample JSON';
    if (/fiction|kpi|consistency/i.test(type)) return 'AI-generated fiction KPI patterns';
    if (/schema/i.test(type)) return 'Sample JSON schema drift';
    if (/invalid json/i.test(type)) return 'Invalid JSON in mock data file';
    return type || 'Finding';
}

function formatRule(issue) {
    const type = String(issue.type || '').toLowerCase();
    if (/credential/i.test(type)) {
        return issue.pattern ? `\`credentials\` / \`${issue.pattern}\`` : '`credentials`';
    }
    if (/production leak/i.test(type)) return '`production-leak`';
    if (/fiction|kpi|consistency/i.test(type)) return '`fiction-kpi-patterns`';
    if (/schema/i.test(type)) return '`json-schema`';
    return issue.pattern ? `\`${issue.pattern}\`` : `\`${issue.type || 'scan-rule'}\``;
}

function findingRisk(issue) {
    if (issue.alertTemplate?.impact) return issue.alertTemplate.impact;
    const type = String(issue.type || '').toLowerCase();
    if (/credential/i.test(type)) {
        return 'If this branch is pushed to a client repo, staging host, or public fork, infrastructure credentials may be exposed.';
    }
    if (/production leak/i.test(type)) {
        return 'Production code resolves mock or sample JSON instead of live data. Users may see demo metrics at go-live.';
    }
    if (/fiction|kpi|consistency/i.test(type)) {
        return 'Placeholder metrics from AI-assisted edits remain in committed files, inflating UI readouts with unverified numbers.';
    }
    if (/schema/i.test(type)) {
        return 'Sample JSON does not match registered page specs, which can break dashboard rendering or validation in CI.';
    }
    return issue.description || 'Review this finding before production deployment.';
}

function defaultRemediation(issue) {
    if (issue.alertTemplate?.immediateAction) return issue.alertTemplate.immediateAction;
    const type = String(issue.type || '').toLowerCase();
    if (/credential/i.test(type)) {
        return 'Remove the hardcoded string. Load from environment or a secret manager. Rotate the credential if it was ever real.';
    }
    if (/production leak/i.test(type)) {
        return 'Replace hardcoded sample paths with API calls or env-based config. Keep fixtures in test-only paths.';
    }
    if (/fiction|kpi|consistency/i.test(type)) {
        return 'Replace template KPI values with repository-audit baseline values or live reporting data.';
    }
    if (/schema/i.test(type)) {
        return 'Update mock data to conform to dashboard page schema requirements.';
    }
    return 'Review and remediate before enabling `--gate` on main.';
}

function formatFindingTable(issue) {
    const rows = [
        ['File', formatFileLocation(issue)],
        ['Rule', formatRule(issue)]
    ];

    if (issue.snippet) {
        rows.push(['Snippet', `\`${issue.snippet}\``]);
    } else if (/fiction|kpi|consistency/i.test(String(issue.type || ''))) {
        rows.push(['Detected values', issue.description || 'See scan report for matched values']);
    }

    rows.push(['Risk', findingRisk(issue)]);
    rows.push(['Remediation', issue.recommendedAction || defaultRemediation(issue)]);

    if (issue.alertTemplate) {
        const at = issue.alertTemplate;
        if (at.cwe) {
            rows.push(['CWE', at.cwe]);
        }
        if (at.remediationSteps && at.remediationSteps.length > 0) {
            rows.push(['Remediation steps', at.remediationSteps.map((s, i) => `${i + 1}. ${s}`).join('  ')]) ;
        }
        if (at.preventionGuidance) {
            rows.push(['Prevention', at.preventionGuidance]);
        }
        if (at.references && at.references.length > 0) {
            rows.push(['References', at.references.join(', ')]);
        }
        if (at.rotationRequired) {
            rows.push(['Rotation required', 'Yes — rotate any credentials that may have been exposed']);
        }
    }

    const body = rows.map(([label, value]) => `| **${label}** | ${value} |`).join('\n');
    return `| Field | Detail |\n|-------|--------|\n${body}`;
}

function formatFindingSection(issue) {
    return `### ${capitalize(issue.severity)} — ${findingTitle(issue)}\n\n${formatFindingTable(issue)}`;
}

function buildRemainingSummary(mediumRemainder, lowIssues) {
    const lines = [];

    if (mediumRemainder.length) {
        const count = mediumRemainder.reduce((sum, issue) => sum + (issue.count || 1), 0);
        const samplePath = mediumRemainder[0]?.filePath || 'configured sample paths';
        const folder = samplePath.includes('/')
            ? samplePath.split('/').slice(0, -1).join('/')
            : samplePath;
        lines.push(`- **${count} medium finding${count === 1 ? '' : 's'}** across sample JSON under \`${folder}\` — missing required page-spec keys and cross-file KPI drift vs baseline.`);
    }

    if (lowIssues.length) {
        const count = lowIssues.reduce((sum, issue) => sum + (issue.count || 1), 0);
        lines.push(`- **${count} low finding${count === 1 ? '' : 's'}** — informational roadmap template pattern (no gate block by default).`);
    }

    if (!lines.length) return '';

    return `### Medium — Additional schema and consistency notes (summary)\n\n${lines.join('\n')}`;
}

function _buildActionPlanRows(issues) {
    if (!issues.length) {
        return '| — | — | No findings detected |';
    }

    const sorted = sortIssuesBySeverity(issues);
    const actionable = sorted.filter((issue) => ['critical', 'high', 'medium'].includes(issue.severity));

    if (!actionable.length) {
        return '| — | — | No blocking findings detected |';
    }

    return actionable.map((issue) => {
        const location = issue.line
            ? `\`${issue.filePath}:${issue.line}\``
            : `\`${issue.filePath}\``;
        const rule = formatRule(issue);
        const remediation = issue.recommendedAction || defaultRemediation(issue);
        return `| ${location} | ${rule} | ${remediation} |`;
    }).join('\n');
}

function buildDetailedFindings(issues) {
    if (!issues.length) {
        return 'No blocking or warning findings detected in configured scan paths.';
    }

    const sorted = sortIssuesBySeverity(issues);
    const critical = sorted.filter((issue) => issue.severity === 'critical');
    const high = sorted.filter((issue) => issue.severity === 'high');
    const medium = sorted.filter((issue) => issue.severity === 'medium');
    const low = sorted.filter((issue) => issue.severity === 'low');

    const sections = [];

    for (const issue of [...critical, ...high]) {
        sections.push(formatFindingSection(issue));
    }

    if (medium.length === 1) {
        sections.push(formatFindingSection(medium[0]));
        const summary = buildRemainingSummary([], low);
        if (summary) sections.push(summary);
    } else if (medium.length > 1) {
        sections.push(formatFindingSection(medium[0]));
        const summary = buildRemainingSummary(medium.slice(1), low);
        if (summary) sections.push(summary);
    } else if (low.length) {
        sections.push(buildRemainingSummary([], low));
    }

    sections.push('*(Full machine-readable output available as `.simplebeacon/report.json` and assessment JSON on delivery.)*');
    return sections.join('\n\n');
}

function resolveComplianceRules(report, assessment, projectRoot) {
    if (assessment?.complianceChecklist?.rules?.length) {
        return assessment.complianceChecklist.rules;
    }
    return evaluateComplianceChecklist(report, { projectRoot }).rules;
}

function findRuleForRow(rules, row) {
    return rules.find((rule) => rule.check === row.check)
        || rules.find((rule) => CHECK_ID_MAP[rule.id] === row.check);
}

function formatChecklistStatus(status) {
    if (status === 'pass') return '**PASS**';
    if (status === 'fail') return '**FAIL**';
    if (status === 'skip') return 'N/A';
    return '—';
}

function buildComplianceTable(report, assessment, projectRoot) {
    const rules = resolveComplianceRules(report, assessment, projectRoot);
    const rows = AUDIT_CHECKLIST_ROWS.map((row) => {
        const rule = findRuleForRow(rules, row);
        if (rule) {
            return `| ${row.title} | ${formatChecklistStatus(rule.status)} | ${rule.evidence || '—'} |`;
        }

        let status = '**PASS**';
        let notes = 'Not evaluated';

        if (row.check === 'zero-credential-findings') {
            const findings = report.credentialFindings ?? 0;
            status = findings === 0 ? '**PASS**' : '**FAIL**';
            notes = findings === 0
                ? 'No credential patterns in scanned paths'
                : `${findings} credential pattern(s) detected`;
        } else if (row.check === 'zero-production-leaks') {
            const findings = report.productionLeakFindings ?? 0;
            status = findings === 0 ? '**PASS**' : '**FAIL**';
            notes = findings === 0
                ? 'No mock/sample path references in production directories'
                : `${findings} production-path leak(s) detected`;
        } else if (row.check === 'schema-compliance') {
            const checked = report.schemaChecked ?? 0;
            if (!checked) {
                status = 'N/A';
                notes = 'No registered page samples in this project';
            } else {
                const passed = report.schemaPassed ?? 0;
                const ok = passed === checked;
                status = ok ? '**PASS**' : '**FAIL**';
                notes = ok
                    ? 'Active page samples match registered specs'
                    : `${passed}/${checked} samples pass schema checks`;
            }
        } else if (row.check === 'consistency-pass') {
            if (report.consistencyChecked == null || report.consistencyChecked === 0) {
                status = 'N/A';
                notes = 'Consistency anchors not configured for this profile';
            } else {
                const ok = report.consistencyPassed === true || (report.consistencyScore ?? 0) >= 95;
                status = ok ? '**PASS**' : '**FAIL**';
                notes = ok
                    ? 'No fiction KPI drift in anchor samples'
                    : 'Template or baseline drift detected in sample JSON';
            }
        }

        return `| ${row.title} | ${status} | ${notes} |`;
    });

    return `| Checklist item | Status | Notes |\n|----------------|--------|-------|\n${rows.join('\n')}`;
}

function buildHeadline(report, assessment, severityCounts, _issues) {
    if (assessment?.executiveSummary?.headline) {
        return assessment.executiveSummary.headline;
    }

    const parts = [];
    if (severityCounts.critical) {
        parts.push(`${severityCounts.critical} critical issue${severityCounts.critical === 1 ? '' : 's'}`);
    }
    if (severityCounts.high) {
        parts.push(`${severityCounts.high} high-severity issue${severityCounts.high === 1 ? '' : 's'}`);
    }
    if (severityCounts.medium) {
        parts.push(`${severityCounts.medium} medium issue${severityCounts.medium === 1 ? '' : 's'}`);
    }

    if (!parts.length) {
        return report.gate?.pass === false
            ? 'Gate failed on configured severities — review raw report for details.'
            : 'Clean scan — no blocking mock, fiction, or credential findings in configured paths.';
    }

    const gateNote = report.gate?.pass === false
        ? 'These findings would fail a standard `simplebeacon scan --gate` CI job today.'
        : 'Gate passes under current failOn policy — review medium/low findings before go-live.';

    return `${capitalize(parts.join(', '))} detected. ${gateNote}`;
}

function _buildCommandsRun(options) {
    if (options.assessment?.commandsRun?.length) {
        const commands = [...options.assessment.commandsRun];
        if (!commands.some((cmd) => /compliance/.test(cmd))) {
            commands.push('npx simplebeacon compliance --format json --output .simplebeacon/compliance-result.json');
        }
        if (!commands.some((cmd) => /report/.test(cmd))) {
            commands.push('npx simplebeacon report --company "[Company]" --client "[Project]" --output AUDIT_REPORT.md');
        }
        return commands;
    }

    const company = options.company || '[Company]';
    const client = options.client || '[Project]';
    const assessor = options.assessor || '[Assessor]';

    return [
        'npx simplebeacon scan --path . --format json --output .simplebeacon/report.json --gate',
        `npx simplebeacon assess --company "${company}" --assessor "${assessor}"`,
        'npx simplebeacon compliance --format json --output .simplebeacon/compliance-result.json',
        `npx simplebeacon report --company "${company}" --client "${client}" --assessor "${assessor}" --output AUDIT_REPORT.md`
    ];
}

function buildExecutiveSummaryMetricsTables(report, _options = {}) {
    const issues = collectIssues(report);
    const severityCounts = resolveSeverityCounts(report, issues);
    const totalFiles = report.totalFiles ?? report.filesAnalyzed ?? 0;

    return `| Metric | Value |
|--------|-------|
| **Total files scanned** | ${totalFiles} |
| **Gate result** | ${formatGateResult(report.gate)} |

### Vulnerability count by severity

| Severity | Count |
|----------|-------|
| Critical | ${severityCounts.critical} |
| High | ${severityCounts.high} |
| Medium | ${severityCounts.medium} |
| Low | ${severityCounts.low} |`;
}

function buildExecutiveSummaryBody(report, options = {}) {
    const issues = collectIssues(report);
    const severityCounts = resolveSeverityCounts(report, issues);
    const headline = buildHeadline(report, options.assessment, severityCounts, issues);

    return `Simplebeacon performed a read-only static analysis on the provided repository root. The scan targeted hardcoded credentials, production mock data leaks, AI-generated fiction patterns, and schema consistency in configured sample paths.

${buildExecutiveSummaryMetricsTables(report, options)}

**Headline:** ${headline}`;
}

const EXECUTIVE_SUMMARY_START = '## Executive summary\n\n';
const EXECUTIVE_SUMMARY_END = '\n\n---\n\n## Detailed findings';

function replaceExecutiveSummaryBody(markdown, newBody) {
    const startIdx = markdown.indexOf(EXECUTIVE_SUMMARY_START);
    const endIdx = markdown.indexOf(EXECUTIVE_SUMMARY_END);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        throw new Error('Executive summary section not found in audit markdown');
    }
    return `${markdown.slice(0, startIdx + EXECUTIVE_SUMMARY_START.length)}${newBody.trim()}${markdown.slice(endIdx)}`;
}

function compileAuditReportMarkdown(report, options = {}) {
    if (!report || typeof report !== 'object') {
        throw new Error('Report JSON is required');
    }

    const issues = collectIssues(report);
    const client = options.client || options.targetProject || options.company || 'Client project';
    const company = options.company || client;
    const assessor = options.assessor || 'Simplebeacon Security Audit Service';
    const branchLabel = options.branch ? ` (${options.branch} branch)` : '';
    const generatedAt = report.generatedAt || options.assessment?.generatedAt || null;
    const assessment = options.assessment || null;
    const projectRoot = options.projectRoot || report.projectRoot || '';
    const executiveSummary = buildExecutiveSummaryBody(report, { ...options, assessment });
    const detailedFindings = buildDetailedFindings(issues);
    const howToFix = buildHowToFixSection(issues, assessment);
    const actionPlan = buildPersonalizedActionPlan(issues, assessment);
    const complianceTable = buildComplianceTable(report, assessment, projectRoot);
    const commandsRun = _buildCommandsRun({ ...options, assessment, company, client, assessor });

    return `# Simplebeacon Pre-Launch Code Audit Report

**Target project:** ${client}${branchLabel}  
**Prepared for:** ${company}  
**Assessor:** ${assessor}  
**Date:** ${formatReportDate(generatedAt)}  
**Audit type:** Static source code leak and AI-fiction analysis (read-only)

---

## Executive summary

${executiveSummary}

---

## Detailed findings

${detailedFindings}

---

## How to fix each issue

${howToFix}

---

## Your personalized action plan

${actionPlan}

---

## Compliance and gate recommendations

${complianceTable}

**Recommended CI action**

\`\`\`bash
npx simplebeacon init
npx simplebeacon scan --gate --format json --output .simplebeacon/report.json
\`\`\`

Add \`.github/workflows/simplebeacon.yml\` from the Simplebeacon repo examples so PRs fail on high-severity findings.

**Recommended local hook**

\`\`\`bash
npx simplebeacon hook install
\`\`\`

---

## Commands run (this audit)

\`\`\`bash
${commandsRun.join('\n')}
\`\`\`

---

## Disclaimer

This assessment is an **opinion-based, static technical review** of the source files provided at the time of evaluation. It is not a legal compliance guarantee, formal penetration test, SOC 2 attestation, or certification that the system is secure in production. Findings depend on configured scan paths, rules, and allowlists. The client remains responsible for remediation and release decisions.`;
}

/** @deprecated Use compileAuditReportMarkdown */
function compileReport(report, clientName, assessorName = 'Simplebeacon Security Audit Service') {
    return compileAuditReportMarkdown(report, {
        client: clientName,
        company: clientName,
        assessor: assessorName
    });
}

module.exports = {
    compileAuditReportMarkdown,
    compileReport,
    collectIssues,
    resolveSeverityCounts,
    buildDetailedFindings,
    buildComplianceTable,
    buildExecutiveSummaryBody,
    buildExecutiveSummaryMetricsTables,
    replaceExecutiveSummaryBody,
    buildHowToFixSection,
    buildPersonalizedActionPlan,
    formatRule,
    defaultRemediation,
    findingTitle,
    normalizeIssue,
    formatReportDate
};
