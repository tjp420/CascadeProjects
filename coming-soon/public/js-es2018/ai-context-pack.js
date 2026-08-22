/**
 * SimpleBeacon AI Context Pack — universal exports for Cursor, Copilot, Claude, Windsurf, etc.
 * Builds instructions from locally collected scan data only (no source upload).
 */
(function (global) {
    'use strict';
    var DOMAIN_KEY = 'sb_ai_domain_profile';
    var DOMAIN_HINTS = {
        generic: 'General software. Extend existing handlers inline; match file naming and module system already in the repo.',
        game: 'Game/interactive software. Respect frame/update loops, asset pipeline paths, and platform SDK patterns. Avoid blocking I/O on the main thread.',
        government: 'Government/regulated software. No external telemetry in production paths, env-based secrets only, audit logging, data minimization, fail-closed auth.',
        enterprise: 'Enterprise SaaS. Tenant isolation, idempotent webhooks, billing tier awareness, SOC2-friendly logging (no secrets/PII in logs).',
        healthcare: 'Healthcare-adjacent. PHI minimization, access logging, no patient identifiers in fixtures, encrypt data at rest/in transit.'
    };
    var UNIVERSAL_RULES = [
        'Read agent-supercharge.md, agent-brief.md, and ai-context.md before editing.',
        'For cleanup: read file-reduction-ai-notes.md and cleanup-ai-notes.json when present.',
        'Extend existing files — do not create parallel modules unless the scan report requires it.',
        'Never commit secrets, mock production paths, or hardcoded KPIs.',
        'Match the repo module system (require/import), naming (kebab-case files), and error-handling style.',
        'Fix gate-blocking (critical/high) findings before refactors or new features.',
        'When SimpleBeacon MCP is available: supercharge_agent at session start, scan_snippet before apply, scan_file after save, handoff_check before done.'
    ];
    var MCP_RULE_SNIPPET = '---\n'
        + 'description: SimpleBeacon Agent Supercharge — any coding agent plugin (local-only)\n'
        + 'alwaysApply: true\n'
        + '---\n\n'
        + '# SimpleBeacon Agent Supercharge\n\n'
        + 'Start every session with **`supercharge_agent`** — mission, gate, code suggestions, plugin status.\n\n'
        + '1. **`supercharge_agent`** — one-call mission briefing\n'
        + '2. **`scan_snippet`** before applying edits\n'
        + '3. **`code_suggestions`** for before/after fix hints\n'
        + '4. **`handoff_check`** before claiming done\n\n'
        + 'Wire plugins: **`install_agent_plugin`** or `npx simplebeacon init --starter --hosts all`\n'
        + 'Read `.simplebeacon/agent-supercharge.md` when present. Do not upload source.\n';
    function pickIssues(report) {
        if (!report || typeof report !== 'object')
            return [];
        var raw = report.detectedIssues || report.rawIssues || report.findings || report.issues || [];
        return Array.isArray(raw) ? raw : [];
    }
    function projectLabel(report) {
        return report.projectRoot || report.projectPath || report.scanTargetRoot || 'browser-local';
    }
    function getDomainProfile(explicit) {
        if (explicit)
            return explicit;
        try {
            return localStorage.getItem(DOMAIN_KEY) || 'generic';
        }
        catch (_) {
            return 'generic';
        }
    }
    function saveDomainProfile(domain) {
        try {
            localStorage.setItem(DOMAIN_KEY, domain);
        }
        catch (_) { /* ignore */ }
    }
    function extractCollectedInsights(report) {
        var issues = pickIssues(report);
        var aiCtx = report.aiContext || {};
        var pc = aiCtx.projectContext || {};
        var sev = report.severityCounts || {};
        var fixes = Array.isArray(aiCtx.suggestedFixes) ? aiCtx.suggestedFixes : [];
        var deps = Array.isArray(aiCtx.moduleDependencies) ? aiCtx.moduleDependencies : [];
        var criteria = Array.isArray(aiCtx.completionCriteria) ? aiCtx.completionCriteria : [];
        var blocking = issues.filter(function (i) {
            var s = String(i.severity || i.sev || '').toLowerCase();
            return s === 'critical' || s === 'high';
        });
        var fileList = Array.isArray(report.fileList) ? report.fileList.slice(0, 30) : [];
        return {
            project: projectLabel(report),
            gatePass: !!(report.gate && report.gate.pass),
            qualityScore: report.qualityScore,
            filesScanned: report.repositoryFilesTotal || report.totalFiles || report.filesAnalyzed,
            severityCounts: sev,
            issueCount: report.issueCount || issues.length,
            blockingCount: blocking.length,
            suggestedFixCount: fixes.length,
            dominantLanguage: pc.dominantLanguage || null,
            buildTool: pc.buildTool || null,
            buildCommand: pc.buildCommand || pc.buildCommand || null,
            lintCommand: pc.lintCommand || null,
            scanEnvironment: pc.scanEnvironment || 'browser-sandbox',
            moduleDependencies: deps.slice(0, 12),
            completionCriteria: criteria.slice(0, 8),
            topBlocking: blocking.slice(0, 8).map(function (i) {
                return {
                    severity: i.severity || i.sev,
                    type: i.type || i.category,
                    filePath: i.filePath || i.file,
                    fix: i.fix || i.impact
                };
            }),
            samplePaths: fileList,
            collectedAt: new Date().toISOString()
        };
    }
    function enrichReportForAi(report, domainProfile) {
        if (!report || typeof report !== 'object')
            return report;
        var domain = getDomainProfile(domainProfile);
        var insights = extractCollectedInsights(report);
        report.aiContext = report.aiContext || {};
        report.aiContext.projectContext = Object.assign({}, report.aiContext.projectContext || {}, {
            domainProfile: domain,
            domainGuidance: DOMAIN_HINTS[domain] || DOMAIN_HINTS.generic,
            gatePass: insights.gatePass,
            collectedInsights: insights
        });
        report.aiContext.universalCodingRules = UNIVERSAL_RULES.concat([
            'Domain: ' + (DOMAIN_HINTS[domain] || DOMAIN_HINTS.generic)
        ]);
        return report;
    }
    function buildAiContextJson(report, domainProfile, notes) {
        var domain = getDomainProfile(domainProfile);
        var enriched = enrichReportForAi(JSON.parse(JSON.stringify(report)), domain);
        return {
            schemaVersion: '3.0',
            generatedAt: new Date().toISOString(),
            compatibleAssistants: ['cursor', 'github-copilot', 'claude', 'windsurf', 'codex', 'generic'],
            projectPath: projectLabel(report),
            domainProfile: domain,
            notes: notes || '',
            collected: extractCollectedInsights(report),
            codingRules: UNIVERSAL_RULES,
            domainGuidance: DOMAIN_HINTS[domain] || DOMAIN_HINTS.generic,
            reportSummary: {
                type: report.type,
                gate: report.gate,
                qualityScore: report.qualityScore,
                issueCount: report.issueCount
            },
            suggestedFixes: (report.aiContext && report.aiContext.suggestedFixes)
                ? report.aiContext.suggestedFixes.slice(0, 30) : [],
            detectedIssues: pickIssues(report).slice(0, 40),
            moduleDependencies: (report.aiContext && report.aiContext.moduleDependencies) || [],
            completionCriteria: (report.aiContext && report.aiContext.completionCriteria) || []
        };
    }
    function isPaidUser() {
        try {
            if (typeof global.SbAuth !== 'undefined') {
                if (typeof global.SbAuth.isPaidTier === 'function' && global.SbAuth.isPaidTier())
                    return true;
                if (typeof global.SbAuth.isAccountSignedIn === 'function' && global.SbAuth.isAccountSignedIn())
                    return true;
            }
        }
        catch (_) { /* ignore */ }
        return false;
    }
    function formatAgentBrief(report, projectRoot) {
        var paid = isPaidUser();
        var data = report && typeof report === 'object' ? report : {};
        var gate = data.gate || {};
        var pass = gate.pass === true;
        var score = data.qualityScore;
        if (score == null && data.summary)
            score = data.summary.qualityScore;
        if (score == null)
            score = 'N/A';
        var issues = pickIssues(data);
        var blocking = issues.filter(function (i) {
            var sev = String(i.severity || i.sev || '').toLowerCase();
            return sev === 'critical' || sev === 'high' || i.blocking === true;
        });
        if (!paid) {
            var teaser = (blocking.length ? blocking : issues).slice(0, 1);
            var freeLines = [
                '# SimpleBeacon agent brief (free preview)',
                '',
                '- **Gate:** ' + (pass ? 'PASS' : 'FAIL'),
                '- **Issues detected:** ' + issues.length,
                '',
                'Free tier = **2/10** agent help. Upgrade for propose_fix, verify_fix, scan_staged, and full pattern IDs.',
                '- https://simplebeacon.ai/pricing',
                ''
            ];
            if (teaser.length) {
                freeLines.push('- Sample: [' + (teaser[0].severity || 'high') + '] issue (details redacted on free tier)');
                freeLines.push('');
            }
            return freeLines.join('\n');
        }
        var top = (blocking.length ? blocking : issues).slice(0, 12);
        var lines = [
            '# SimpleBeacon agent brief',
            '',
            '- **Project:** ' + (projectRoot || projectLabel(data)),
            '- **Gate:** ' + (pass ? 'PASS' : 'FAIL'),
            '- **Quality score:** ' + score,
            '- **Issues:** ' + issues.length,
            '- **Blocking / high:** ' + blocking.length,
            '- **Updated:** ' + new Date().toISOString(),
            '',
            'Start with MCP `supercharge_agent`. Loop: `scan_snippet`, `code_suggestions`, `handoff_check`. Paid: scan_file, propose_fix, verify_fix.',
            ''
        ];
        var pc = (data.aiContext && data.aiContext.projectContext) || {};
        if (pc.dominantLanguage || pc.buildTool || pc.domainProfile) {
            lines.push('## Project context');
            lines.push('');
            if (pc.dominantLanguage)
                lines.push('- **Language:** ' + pc.dominantLanguage);
            if (pc.buildTool)
                lines.push('- **Build:** ' + pc.buildTool);
            if (pc.domainProfile)
                lines.push('- **Domain:** ' + pc.domainProfile);
            if (pc.domainGuidance)
                lines.push('- **Guidance:** ' + pc.domainGuidance);
            lines.push('');
        }
        if (top.length > 0) {
            lines.push('## Top findings');
            lines.push('');
            top.forEach(function (issue) {
                var sev = issue.severity || issue.sev || 'low';
                var type = issue.type || issue.pattern || issue.category || 'issue';
                var desc = String(issue.description || issue.message || issue.title || '').slice(0, 180);
                var file = issue.file || issue.path || issue.filePath || '';
                var fileStr = Array.isArray(file) ? file.slice(0, 3).join(', ') : String(file || '');
                lines.push('- [' + sev + '] ' + type + (fileStr ? ' @ ' + fileStr : '') + (desc ? ': ' + desc : ''));
            });
            lines.push('');
        }
        else {
            lines.push('_No findings in the latest report._');
            lines.push('');
        }
        lines.push('Remediate gate-blocking issues before claiming the workspace is clean.');
        return lines.join('\n');
    }
    function buildSuperchargeBrief(report) {
        var brief = formatAgentBrief(report);
        var gate = (report && report.gate) || {};
        var blocking = gate.blockingCount != null ? gate.blockingCount : 0;
        var mission = gate.pass
            ? 'Gate passed — run handoff_check before claiming done'
            : (blocking > 0 ? ('Fix ' + blocking + ' gate blocker(s)') : 'Run scan_project with gate:true');
        return [
            '# SimpleBeacon Agent Supercharge',
            '',
            '> Mission: **' + mission + '**',
            '',
            '1. MCP: **`supercharge_agent`** with writeDisk:true',
            '2. CLI: **`npx simplebeacon supercharge --write-disk`**',
            '3. **`scan_snippet`** before accepting generated code',
            '4. **`handoff_check`** before claiming done',
            '',
            '---',
            '',
            brief
        ].join('\n');
    }
    function buildAiContextMarkdown(report, notes, domainProfile) {
        var domain = getDomainProfile(domainProfile);
        var issues = pickIssues(report);
        var aiCtx = report.aiContext || {};
        var fixes = Array.isArray(aiCtx.suggestedFixes) ? aiCtx.suggestedFixes : [];
        var insights = extractCollectedInsights(report);
        var lines = [
            '## SimpleBeacon AI Context',
            '',
            '- **Project:** ' + projectLabel(report),
            '- **Gate:** ' + (insights.gatePass ? 'PASS' : 'FAIL'),
            '- **Quality score:** ' + (report.qualityScore != null ? report.qualityScore : 'N/A'),
            '- **Files scanned:** ' + (insights.filesScanned || 'N/A'),
            '- **Domain profile:** ' + domain,
            '- **Generated:** ' + insights.collectedAt,
            notes ? '- **Notes:** ' + notes : '',
            '',
            '### Works with',
            '',
            'Cursor · GitHub Copilot · Claude · Windsurf · Codex · any chat agent (paste this file).',
            '',
            '### Domain guidance',
            '',
            DOMAIN_HINTS[domain] || DOMAIN_HINTS.generic,
            '',
            '### Coding rules (from scan data)',
            ''
        ];
        UNIVERSAL_RULES.forEach(function (r) { lines.push('- ' + r); });
        lines.push('');
        if (aiCtx.readerGuide && aiCtx.readerGuide.howToUse) {
            lines.push('### How to use the scan report');
            lines.push('');
            lines.push(aiCtx.readerGuide.howToUse);
            lines.push('');
        }
        if (fixes.length > 0) {
            var cleanFixes = sanitizeSuggestedFixes(fixes);
            lines.push('### Priority fixes (' + Math.min(cleanFixes.length, 15) + ')');
            lines.push('');
            cleanFixes.slice(0, 15).forEach(function (f, idx) {
                lines.push((idx + 1) + '. **' + (f.file || '?') + '**' + (f.line ? ':' + f.line : '')
                    + (f.autoFixable ? ' _(auto-fixable)_' : '')
                    + (f.verificationCommand ? ' — `' + f.verificationCommand + '`' : ''));
                lines.push('   ' + fixGuidanceText(f));
            });
            lines.push('');
        }
        if (insights.moduleDependencies.length) {
            lines.push('### Fix order');
            lines.push('');
            insights.moduleDependencies.forEach(function (d) {
                lines.push('- **' + (d.id || 'step') + ':** ' + (d.reason || ''));
            });
            lines.push('');
        }
        if (issues.length > 0) {
            lines.push('### Findings summary');
            lines.push('');
            issues.slice(0, 40).forEach(function (i) {
                var sev = i.severity || i.sev || 'low';
                var type = i.type || i.category || 'issue';
                var desc = i.description || i.message || i.title || '';
                lines.push('- [' + sev + '] ' + type + (desc ? ': ' + String(desc).slice(0, 120) : ''));
            });
            lines.push('');
        }
        lines.push('_Save as `.simplebeacon/ai-context.md` and @-mention in your AI IDE._');
        return lines.join('\n');
    }
    function buildUniversalPrompt(report, domainProfile) {
        var domain = getDomainProfile(domainProfile);
        var insights = extractCollectedInsights(report);
        var brief = formatAgentBrief(report);
        return [
            'You are the coding assistant for **' + insights.project + '**.',
            '',
            'SimpleBeacon scan: gate **' + (insights.gatePass ? 'PASS' : 'FAIL') + '**, score **'
                + (insights.qualityScore != null ? insights.qualityScore : 'N/A') + '**, '
                + insights.issueCount + ' issues (' + insights.blockingCount + ' blocking/high).',
            '',
            '**Domain (' + domain + '):** ' + (DOMAIN_HINTS[domain] || DOMAIN_HINTS.generic),
            '',
            '**Rules:**',
            UNIVERSAL_RULES.map(function (r) { return '- ' + r; }).join('\n'),
            '',
            insights.suggestedFixCount
                ? ('**Start with ' + insights.suggestedFixCount + ' suggested fixes** in the scan report (security first).')
                : '',
            '',
            '---',
            '',
            brief
        ].filter(Boolean).join('\n');
    }
    function buildCopilotInstructions(report, domainProfile) {
        var domain = getDomainProfile(domainProfile);
        var insights = extractCollectedInsights(report);
        return [
            '# GitHub Copilot / VS Code custom instructions',
            '',
            'Project: ' + insights.project,
            'Gate: ' + (insights.gatePass ? 'PASS' : 'FAIL') + ' | Quality: ' + (insights.qualityScore != null ? insights.qualityScore : 'N/A'),
            '',
            'When generating code for this repository:',
            '',
            DOMAIN_HINTS[domain] || DOMAIN_HINTS.generic,
            '',
            UNIVERSAL_RULES.map(function (r, i) { return (i + 1) + '. ' + r; }).join('\n'),
            '',
            insights.topBlocking.length ? 'Priority issues to avoid repeating:' : '',
            insights.topBlocking.map(function (b) {
                return '- [' + b.severity + '] ' + b.type + (b.filePath ? ' in ' + JSON.stringify(b.filePath).slice(0, 80) : '');
            }).join('\n'),
            '',
            'Install SimpleBeacon VSIX for live scan feedback in the editor.'
        ].filter(Boolean).join('\n');
    }
    function buildAgentsMdSection(report, domainProfile) {
        var domain = getDomainProfile(domainProfile);
        var insights = extractCollectedInsights(report);
        return [
            '## SimpleBeacon AI context (auto-generated from scan)',
            '',
            '- **Project:** ' + insights.project,
            '- **Gate:** ' + (insights.gatePass ? 'PASS' : 'FAIL'),
            '- **Domain profile:** ' + domain,
            '',
            '### Before writing code',
            '',
            DOMAIN_HINTS[domain] || DOMAIN_HINTS.generic,
            '',
            UNIVERSAL_RULES.map(function (r) { return '- ' + r; }).join('\n'),
            '',
            '### Scan artifacts',
            '',
            '- `.simplebeacon/agent-brief.md` — latest gate summary',
            '- `.simplebeacon/ai-context.md` — full context for any AI assistant',
            '- `.simplebeacon/file-reduction-ai-notes.md` — cleanup tiers + reclaim summary (after file-reduction scan)',
            '- `.simplebeacon/cleanup-ai-notes.json` — structured file-reduction data for agents',
            '- `.simplebeacon/report.json` — machine-readable findings + suggestedFixes',
            '',
            'Run `npx simplebeacon scan --gate --offline` before PR merge.'
        ].join('\n');
    }
    function buildClaudeInstructions(report, domainProfile) {
        return buildUniversalPrompt(report, domainProfile);
    }
    function buildCursorPrompt(report, domainProfile) {
        return buildUniversalPrompt(report, domainProfile);
    }
    var ASSISTANT_HINTS = {
        cursor: 'Paste into **Cursor Agent** (Cmd/Ctrl+L). Start with `supercharge_agent` MCP. @-mention .simplebeacon/*.md as you edit.',
        claude: 'Paste at the start of a **Claude** chat or Project. Attach `.simplebeacon/report.json` from the Context Pack if you need full detail.',
        copilot: 'Paste into **GitHub Copilot Chat** or save to `.github/copilot-instructions.md` in your repo.',
        windsurf: 'Paste into **Windsurf Cascade** or add to `.windsurf/rules`. MCP: `npx simplebeacon-mcp --offline`.',
        vscode: 'Opens in the **SimpleBeacon VS Code extension** when embedded; otherwise paste into Copilot Chat.',
        generic: 'Paste into any AI coding assistant. Nothing is uploaded — only paths and findings leave this browser.'
    };
    var FOCUS_LABELS = {
        all: 'All findings',
        blocking: 'Blocking / high only',
        security: 'Security & credentials',
        aiResidue: 'AI residue & quality'
    };
    function isGenericAutoFixSnippet(text) {
        if (!text)
            return false;
        var s = String(text);
        return /AUTO_FIX:\s*ai_residue|\[Auto-Generated Issue\]|Auto-generated stub:\s*replace implementation|throw new Error\('Auto-generated stub/i.test(s);
    }
    function sanitizeSuggestedFixes(fixes) {
        if (!Array.isArray(fixes))
            return [];
        return fixes.filter(function (f) {
            if (!f || typeof f !== 'object')
                return false;
            if (isGenericAutoFixSnippet(f.replacement))
                return false;
            if (isGenericAutoFixSnippet(f.suggestedPatch))
                return false;
            return !!(f.file || f.line || f.type || f.rule);
        });
    }
    function fixGuidanceText(fix) {
        var parts = [];
        if (fix.type)
            parts.push(String(fix.type));
        if (fix.rule)
            parts.push('rule ' + fix.rule);
        if (fix.impact)
            parts.push(String(fix.impact).slice(0, 160));
        if (fix.detail)
            parts.push(String(fix.detail).slice(0, 160));
        if (fix.suggestion)
            parts.push('Suggestion: ' + String(fix.suggestion).slice(0, 120));
        if (!parts.length && fix.replacement && !isGenericAutoFixSnippet(fix.replacement)) {
            parts.push('Replace flagged snippet — inspect file context before applying.');
        }
        if (!parts.length)
            parts.push('Review flagged pattern in file; do not apply generic scanner stubs blindly.');
        return parts.join(' — ');
    }
    function issueMatchesFocus(issue, focus) {
        if (!focus || focus === 'all')
            return true;
        var blob = [
            issue.type, issue.category, issue.pattern, issue.rule,
            issue.description, issue.message, issue.title, issue.impact
        ].join(' ').toLowerCase();
        var sev = String(issue.severity || issue.sev || '').toLowerCase();
        if (focus === 'blocking') {
            return sev === 'critical' || sev === 'high' || issue.blocking === true;
        }
        if (focus === 'security') {
            return /credential|secret|token|security|production|leak|auth|password|api.?key/.test(blob);
        }
        if (focus === 'aiResidue') {
            return /ai residue|error swallow|stub|architecture drift|llm slop|debug|placeholder|roadmap|fiction|maintainability|complexity/.test(blob);
        }
        return true;
    }
    function browserDiscoveryNote(report, insights) {
        var n = Number(insights.filesScanned) || 0;
        if (report && report._browserPartialDiscovery) {
            return 'Browser audit indexed a **partial** folder tree (~' + n.toLocaleString() + ' files). For monorepo-wide fixes run `npx simplebeacon scan . --full --gate` locally and re-handoff.';
        }
        if (insights.scanEnvironment === 'browser-sandbox' && n >= 7000 && n <= 8500) {
            return 'Discovery count (~' + n.toLocaleString() + ') is near Chrome\'s ~8k folder cap — findings may omit sibling packages. Use CLI scan for full coverage.';
        }
        return '';
    }
    function buildHandoffChatPrompt(report, options) {
        options = options || {};
        var notes = options.notes || '';
        var focus = options.focus || 'all';
        var assistant = options.assistant || 'generic';
        var domain = getDomainProfile(options.domainProfile);
        var insights = extractCollectedInsights(report);
        var fixes = sanitizeSuggestedFixes((report.aiContext && report.aiContext.suggestedFixes) || []);
        var issues = pickIssues(report).filter(function (i) { return issueMatchesFocus(i, focus); });
        var blocking = issues.filter(function (i) {
            var s = String(i.severity || i.sev || '').toLowerCase();
            return s === 'critical' || s === 'high' || i.blocking === true;
        });
        var lines = [
            '# SimpleBeacon remediation handoff',
            '',
            ASSISTANT_HINTS[assistant] || ASSISTANT_HINTS.generic,
            '',
            'You are fixing issues from a **local SimpleBeacon audit**. Source code was **not** uploaded — only paths, severities, and guidance below.',
            '',
            '## Scan snapshot',
            '',
            '- **Project:** ' + insights.project,
            '- **Gate:** ' + (insights.gatePass ? 'PASS' : 'FAIL'),
            '- **Quality score:** ' + (insights.qualityScore != null ? insights.qualityScore : 'N/A'),
            '- **Files indexed:** ' + (insights.filesScanned != null ? insights.filesScanned : 'N/A'),
            '- **Issues in scope:** ' + issues.length + ' (' + blocking.length + ' blocking/high)',
            '- **Domain profile:** ' + domain,
            '- **Focus filter:** ' + (FOCUS_LABELS[focus] || focus),
            ''
        ];
        var discNote = browserDiscoveryNote(report, insights);
        if (discNote) {
            lines.push('> **Coverage note:** ' + discNote);
            lines.push('');
        }
        if (notes) {
            lines.push('## Operator notes');
            lines.push('');
            lines.push(notes);
            lines.push('');
        }
        lines.push('## Instructions');
        lines.push('');
        lines.push('1. Fix **critical/high** findings first, then medium.');
        lines.push('2. **Extend existing files** — match repo naming, module system, and error-handling style.');
        lines.push('3. After each file edit: `node -c path/to/file.js` (or equivalent syntax check).');
        lines.push('4. Before claiming done: `npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json`');
        lines.push('5. **Do not** paste generic `throw new Error(\'Auto-generated stub\')` replacements from scanner templates — fix the real issue.');
        lines.push('');
        lines.push('**Domain guidance (' + domain + '):** ' + (DOMAIN_HINTS[domain] || DOMAIN_HINTS.generic));
        lines.push('');
        if (fixes.length) {
            lines.push('## Priority fixes (' + Math.min(fixes.length, 12) + ')');
            lines.push('');
            fixes.slice(0, 12).forEach(function (f, idx) {
                var loc = '**' + (f.file || '?') + '**' + (f.line ? ':' + f.line : '');
                lines.push((idx + 1) + '. ' + loc);
                lines.push('   - ' + fixGuidanceText(f));
                if (f.verificationCommand) {
                    lines.push('   - Verify: `' + f.verificationCommand + '`');
                }
            });
            lines.push('');
        }
        if (blocking.length) {
            lines.push('## Blocking / high findings');
            lines.push('');
            blocking.slice(0, 15).forEach(function (i) {
                var sev = i.severity || i.sev || 'high';
                var type = i.type || i.category || i.pattern || 'issue';
                var file = i.filePath || i.file || i.path || '';
                var fileStr = Array.isArray(file) ? file.slice(0, 2).join(', ') : String(file || '');
                var desc = String(i.description || i.message || i.title || '').slice(0, 140);
                lines.push('- [' + sev + '] **' + type + '**' + (fileStr ? ' @ `' + fileStr + '`' : '') + (desc ? ' — ' + desc : ''));
            });
            lines.push('');
        }
        else if (issues.length) {
            lines.push('## Findings (sample)');
            lines.push('');
            issues.slice(0, 20).forEach(function (i) {
                var sev = i.severity || i.sev || 'medium';
                var type = i.type || i.category || 'issue';
                var desc = String(i.description || i.message || '').slice(0, 100);
                lines.push('- [' + sev + '] ' + type + (desc ? ': ' + desc : ''));
            });
            lines.push('');
        }
        if (insights.moduleDependencies && insights.moduleDependencies.length) {
            lines.push('## Suggested fix order');
            lines.push('');
            insights.moduleDependencies.forEach(function (d) {
                lines.push('- **' + (d.id || 'step') + ':** ' + (d.reason || ''));
            });
            lines.push('');
        }
        lines.push('---');
        lines.push('_Generated ' + new Date().toISOString() + ' by [SimpleBeacon Audit](https://simplebeacon.ai/audit) — local scan, no source upload._');
        return lines.join('\n');
    }
    function buildSendToAiPayload(report, notes, domainProfile) {
        var domain = getDomainProfile(domainProfile);
        var issues = pickIssues(report);
        var aiCtx = report.aiContext || null;
        var cleanFixes = sanitizeSuggestedFixes((aiCtx && aiCtx.suggestedFixes) || []);
        return {
            projectPath: projectLabel(report),
            reportPath: projectLabel(report),
            notes: notes || '',
            domainProfile: domain,
            reportType: report.type || 'simplebeacon-report',
            filesScanned: report.repositoryFilesTotal || report.totalFiles || report.filesAnalyzed || 0,
            reportSummary: {
                gatePass: !!(report.gate && report.gate.pass),
                qualityScore: report.qualityScore,
                repositoryFilesTotal: report.repositoryFilesTotal || report.totalFiles,
                issueCount: report.issueCount || issues.length,
                severityCounts: report.severityCounts || null
            },
            collected: extractCollectedInsights(report),
            issues: issues.slice(0, 50),
            aiContext: aiCtx,
            aiContextJson: buildAiContextJson(report, domain, notes),
            suggestedFixes: cleanFixes.slice(0, 30),
            agentBriefMarkdown: formatAgentBrief(report),
            universalPrompt: buildUniversalPrompt(report, domain),
            copilotInstructions: buildCopilotInstructions(report, domain),
            agentsMdSection: buildAgentsMdSection(report, domain),
            markdown: buildAiContextMarkdown(report, notes, domain),
            handoffPrompt: buildHandoffChatPrompt(report, { notes: notes, domainProfile: domain })
        };
    }
    function getVsCodeApiCached() {
        if (global.__vscodeApiCached)
            return global.__vscodeApiCached;
        if (typeof global.acquireVsCodeApi !== 'function')
            return null;
        try {
            global.__vscodeApiCached = global.acquireVsCodeApi();
            return global.__vscodeApiCached;
        }
        catch (_) {
            return null;
        }
    }
    function executeSendToAiAssistant(report, options) {
        options = options || {};
        if (!report) {
            return Promise.resolve({ ok: false, error: 'No scan report loaded' });
        }
        var domain = options.domainProfile || getDomainProfile();
        var payload = buildSendToAiPayload(report, options.notes || '', domain);
        payload.handoffPrompt = buildHandoffChatPrompt(report, {
            notes: options.notes || '',
            domainProfile: domain,
            focus: options.focus || 'all',
            assistant: options.assistant || 'generic'
        });
        var vscode = getVsCodeApiCached();
        if (vscode && (options.preferVsCode !== false)) {
            try {
                vscode.postMessage({ command: 'sendToAI', data: payload });
                return Promise.resolve({
                    ok: true,
                    method: 'vscode',
                    message: 'Sent to SimpleBeacon VS Code extension'
                });
            }
            catch (err) {
                console.warn('[SbAiContextPack] vscode.postMessage failed:', err);
            }
        }
        return copyText(payload.handoffPrompt).then(function () {
            var isLocal = typeof location !== 'undefined'
                && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
            if (isLocal && options.tryLocalApi !== false) {
                fetch('/api/ai-context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(function () { });
            }
            return {
                ok: true,
                method: 'clipboard',
                message: 'Handoff prompt copied — paste into your AI assistant chat',
                charCount: payload.handoffPrompt.length
            };
        });
    }
    function downloadBlob(filename, content, mime) {
        mime = mime || 'text/plain;charset=utf-8';
        var blob = content instanceof Blob ? content : new Blob([content], { type: mime });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            URL.revokeObjectURL(url);
            a.remove();
        }, 500);
    }
    function formatBytesShort(bytes) {
        var n = Number(bytes) || 0;
        if (n < 1024)
            return n + ' B';
        if (n < 1024 * 1024)
            return (n / 1024).toFixed(1) + ' KB';
        if (n < 1024 * 1024 * 1024)
            return (n / (1024 * 1024)).toFixed(1) + ' MB';
        return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    function extractFileReductionScan(report) {
        if (!report || typeof report !== 'object')
            return null;
        if (report.fileReductionPlan || report.type === 'data-cleanup-report')
            return report;
        if (report.results && report.results.fileReduction)
            return report.results.fileReduction;
        if (report.fileReduction)
            return report.fileReduction;
        if (Array.isArray(report.steps)) {
            var frStep = report.steps.filter(function (s) { return s && s.id === 'file-reduction' && s.scan; })[0];
            if (frStep)
                return frStep.scan;
        }
        if (report.completeScanAnalysis && report.completeScanAnalysis.fileReduction) {
            return report.completeScanAnalysis.fileReduction;
        }
        return null;
    }
    function buildFileReductionContextMarkdown(scan) {
        if (!scan)
            return '';
        var scope = scan.scanScope || {};
        var plan = scan.fileReductionPlan || {};
        var totals = plan.totals || {};
        var summary = scan.summary || {};
        var inv = scan.inventory || {};
        var lines = [
            '# SimpleBeacon file-reduction AI notes',
            '',
            '- **Profile:** ' + (scan.scanProfile || 'file-reduction'),
            '- **Report health:** ' + (scope.reportHealth || 'unknown'),
            scope.rescanRecommended ? '- **Rescan recommended:** yes' : '',
            '',
            '## Reclaim summary',
            '',
            '- **Safe to delete:** ' + formatBytesShort(totals.safeToDeleteBytes || 0),
            '- **Review before delete:** ' + formatBytesShort(totals.reviewBeforeDeleteBytes || summary.reclaimableBytes || 0),
            '- **Unused file candidates:** ' + (plan.unusedFiles && plan.unusedFiles.candidates != null ? plan.unusedFiles.candidates : (summary.unusedFileCandidates || '—')),
            '- **Inventory:** ' + (inv.totalFiles != null ? inv.totalFiles : '—') + ' files',
            ''
        ];
        var dirs = (plan.safeToDelete && plan.safeToDelete.topDirectories) || [];
        if (dirs.length) {
            lines.push('## Safe-delete directories (phase 1)');
            lines.push('');
            dirs.slice(0, 8).forEach(function (d) {
                lines.push('- `' + d.path + '` — ' + formatBytesShort(d.bytes || 0));
            });
            lines.push('');
        }
        lines.push('## Rules for agents');
        lines.push('');
        lines.push('- Dry-run only — confirm each path before deleting.');
        lines.push('- Execute phase 1 before review or investigate tiers.');
        lines.push('- Never delete .simplebeacon/, web/data, or production config without approval.');
        return lines.filter(Boolean).join('\n');
    }
    function buildFileReductionContextJson(scan) {
        if (!scan)
            return null;
        var plan = scan.fileReductionPlan || {};
        var scope = scan.scanScope || {};
        return {
            schemaVersion: '1.0',
            generatedAt: scan.generatedAt || new Date().toISOString(),
            scanProfile: scan.scanProfile || 'file-reduction',
            reportHealth: scope.reportHealth || null,
            rescanRecommended: scope.rescanRecommended === true,
            limitations: scope.limitations || [],
            reclaim: {
                safeToDeleteBytes: plan.totals && plan.totals.safeToDeleteBytes,
                reviewBeforeDeleteBytes: plan.totals && plan.totals.reviewBeforeDeleteBytes,
                unusedFileCandidates: plan.unusedFiles && plan.unusedFiles.candidates,
                totalFindings: scan.summary && scan.summary.totalFindings
            },
            safeDirectories: ((plan.safeToDelete && plan.safeToDelete.topDirectories) || []).slice(0, 8)
        };
    }
    function downloadContextPack(report, options) {
        options = options || {};
        var paid = isPaidUser();
        var domain = getDomainProfile(options.domainProfile);
        var notes = options.notes || '';
        if (!paid) {
            var teaser = {
                schemaVersion: '3.0-free-teaser',
                agentExperience: '2/10',
                gatePass: !!(report && report.gate && report.gate.pass),
                issueCount: pickIssues(report).length,
                upgradeUrl: 'https://simplebeacon.ai/pricing',
                message: 'Full AI context pack (11/10 agent loop) requires a paid license.'
            };
            downloadBlob('simplebeacon-ai-context-teaser.json', JSON.stringify(teaser, null, 2), 'application/json');
            return Promise.resolve();
        }
        var enriched = enrichReportForAi(JSON.parse(JSON.stringify(report)), domain);
        var brief = formatAgentBrief(enriched);
        var supercharge = buildSuperchargeBrief(enriched);
        var aiMd = buildAiContextMarkdown(enriched, notes, domain);
        var universal = buildUniversalPrompt(enriched, domain);
        var copilot = buildCopilotInstructions(enriched, domain);
        var agents = buildAgentsMdSection(enriched, domain);
        var aiJson = JSON.stringify(buildAiContextJson(enriched, domain, notes), null, 2);
        var reportJson = JSON.stringify(enriched, null, 2);
        var fileReductionScan = extractFileReductionScan(enriched);
        var fileReductionMd = buildFileReductionContextMarkdown(fileReductionScan);
        var fileReductionJson = buildFileReductionContextJson(fileReductionScan);
        if (typeof global.JSZip === 'function') {
            var zip = new global.JSZip();
            zip.file('report.json', reportJson);
            zip.file('ai-context.json', aiJson);
            zip.file('.simplebeacon/agent-brief.md', brief);
            zip.file('.simplebeacon/agent-supercharge.md', supercharge);
            zip.file('.simplebeacon/ai-context.md', aiMd);
            if (fileReductionMd) {
                zip.file('.simplebeacon/file-reduction-ai-notes.md', fileReductionMd);
            }
            if (fileReductionJson) {
                zip.file('.simplebeacon/cleanup-ai-notes.json', JSON.stringify(fileReductionJson, null, 2));
            }
            zip.file('universal-prompt.md', universal);
            zip.file('copilot-instructions.md', copilot);
            zip.file('AGENTS-snippet.md', agents);
            zip.file('cursor-prompt.md', universal);
            zip.file('.cursor/rules/simplebeacon-agent.mdc', MCP_RULE_SNIPPET);
            zip.file('README-AI-CONTEXT.txt', [
                'SimpleBeacon AI Context Pack — works with ALL coding assistants',
                '',
                'Cursor: paste universal-prompt.md or @-mention .simplebeacon/*.md',
                'GitHub Copilot: paste copilot-instructions.md into custom instructions',
                'Claude / ChatGPT: paste universal-prompt.md at start of session',
                'Windsurf / Codex: use ai-context.json or AGENTS-snippet.md',
                '',
                '1. Copy .simplebeacon/*.md into your repo',
                '2. Optional: append AGENTS-snippet.md to AGENTS.md',
                '3. After file-reduction scan: use cleanup-ai-notes.json for cleanup agents',
                '4. MCP Agent Supercharge: npx simplebeacon init --starter --hosts all',
                '',
                'All data from local scan — no source uploaded.'
            ].join('\n'));
            return zip.generateAsync({ type: 'blob' }).then(function (blob) {
                var root = String(projectLabel(report)).replace(/[^\w.-]+/g, '_').slice(0, 40) || 'project';
                downloadBlob('simplebeacon-ai-context-' + root + '.zip', blob, 'application/zip');
            });
        }
        downloadBlob('ai-context.json', aiJson, 'application/json');
        downloadBlob('agent-brief.md', brief, 'text/markdown');
        downloadBlob('universal-prompt.md', universal, 'text/markdown');
        return Promise.resolve();
    }
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            try {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                resolve();
            }
            catch (e) {
                reject(e);
            }
        });
    }
    function flashButton(btn, doneLabel, defaultLabel) {
        if (!btn)
            return;
        btn.textContent = doneLabel;
        setTimeout(function () { btn.textContent = defaultLabel; }, 2000);
    }
    function renderSuggestedFixes(container, report, limit) {
        if (!container)
            return;
        limit = limit || 10;
        var fixes = sanitizeSuggestedFixes((report && report.aiContext && Array.isArray(report.aiContext.suggestedFixes))
            ? report.aiContext.suggestedFixes : []);
        container.innerHTML = '';
        if (!fixes.length) {
            container.innerHTML = '<li class="sb-ai-fix-empty">No structured fixes — use <strong>Send to AI Assistant</strong> for a handoff prompt, or run a deeper scan.</li>';
            return;
        }
        fixes.slice(0, limit).forEach(function (f) {
            var li = document.createElement('li');
            li.className = 'sb-ai-fix-item';
            var title = document.createElement('div');
            title.className = 'sb-ai-fix-title';
            title.textContent = (f.file || 'unknown') + (f.line ? ':' + f.line : '')
                + (f.type ? ' · ' + f.type : '');
            var meta = document.createElement('div');
            meta.className = 'sb-ai-fix-meta';
            meta.textContent = fixGuidanceText(f)
                + (f.verificationCommand ? ' · verify: ' + f.verificationCommand : '');
            li.appendChild(title);
            li.appendChild(meta);
            container.appendChild(li);
        });
        if (fixes.length > limit) {
            var more = document.createElement('li');
            more.className = 'sb-ai-fix-more';
            more.textContent = '+' + (fixes.length - limit) + ' more in handoff prompt / ai-context.json';
            container.appendChild(more);
        }
    }
    function renderCollectedSummary(container, report, domainProfile) {
        if (!container)
            return;
        var ins = extractCollectedInsights(report);
        var domain = getDomainProfile(domainProfile);
        container.innerHTML = ''
            + '<span class="sb-ai-chip">Gate: ' + (ins.gatePass ? 'PASS' : 'FAIL') + '</span>'
            + '<span class="sb-ai-chip">' + (ins.filesScanned || '?') + ' files</span>'
            + '<span class="sb-ai-chip">' + ins.issueCount + ' issues</span>'
            + '<span class="sb-ai-chip">' + ins.suggestedFixCount + ' fixes</span>'
            + '<span class="sb-ai-chip">' + domain + '</span>'
            + '<span class="sb-ai-chip sb-ai-chip--muted">Cursor · Copilot · Claude · Windsurf</span>';
    }
    function sbRenderAiContextPack(data, domainProfile) {
        if (!data)
            return;
        var domain = getDomainProfile(domainProfile);
        var enriched = enrichReportForAi(data, domain);
        global.currentReport = enriched;
        global.lastScanReport = enriched;
        global.reportData = enriched;
        if (typeof global.__simplebeaconSetReportForAI === 'function') {
            global.__simplebeaconSetReportForAI(enriched);
        }
        var panel = document.getElementById('aiContextPackPanel');
        if (panel)
            panel.style.display = 'block';
        var tokenRow = document.getElementById('tokenActionRow');
        if (tokenRow)
            tokenRow.style.display = 'block';
        var sendBtn = document.getElementById('upload-send-ai-btn');
        if (sendBtn)
            sendBtn.style.display = 'block';
        var domainSelect = document.getElementById('aiDomainProfile');
        if (domainSelect && domainSelect.value !== domain)
            domainSelect.value = domain;
        renderCollectedSummary(document.getElementById('aiCollectedSummary'), enriched, domain);
        renderSuggestedFixes(document.getElementById('aiSuggestedFixes'), enriched, 10);
        var certEmpty = document.getElementById('certEmptyState');
        if (certEmpty)
            certEmpty.style.display = 'none';
        try {
            document.body.classList.add('audit-page--has-results');
        }
        catch (_) { /* ignore */ }
    }
    function wireAuditAiContextPackUi() {
        if (global.__sbAiContextPackWired)
            return;
        global.__sbAiContextPackWired = true;
        var downloadBtn = document.getElementById('aiDownloadPackBtn');
        var copyUniversalBtn = document.getElementById('aiCopyUniversalPromptBtn');
        var copyCopilotBtn = document.getElementById('aiCopyCopilotBtn');
        var copyAgentsBtn = document.getElementById('aiCopyAgentsBtn');
        var copyBriefBtn = document.getElementById('aiCopyBriefBtn');
        var copySuperchargeBtn = document.getElementById('aiCopySuperchargeBtn');
        var copyContextBtn = document.getElementById('aiCopyContextBtn');
        var copyJsonBtn = document.getElementById('aiCopyAiJsonBtn');
        var domainSelect = document.getElementById('aiDomainProfile');
        var openSendBtn = document.getElementById('aiOpenSendPanelBtn');
        if (domainSelect) {
            var saved = getDomainProfile();
            if (saved)
                domainSelect.value = saved;
            domainSelect.addEventListener('change', function () {
                saveDomainProfile(domainSelect.value);
                var report = global.currentReport || global.lastScanReport;
                if (report)
                    sbRenderAiContextPack(report, domainSelect.value);
            });
        }
        function getReport() {
            return global.currentReport || global.lastScanReport || global.reportData || null;
        }
        function getDomain() {
            return domainSelect ? domainSelect.value : getDomainProfile();
        }
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function () {
                var report = getReport();
                if (!report)
                    return alert('Run a scan or import a report first.');
                downloadBtn.disabled = true;
                downloadBtn.textContent = 'Building…';
                downloadContextPack(report, { domainProfile: getDomain() }).finally(function () {
                    downloadBtn.disabled = false;
                    downloadBtn.textContent = 'Download Context Pack (.zip)';
                });
            });
        }
        if (copyUniversalBtn) {
            copyUniversalBtn.addEventListener('click', function () {
                var report = getReport();
                if (!report)
                    return alert('No report loaded.');
                copyText(buildUniversalPrompt(report, getDomain())).then(function () {
                    flashButton(copyUniversalBtn, 'Copied ✓', 'Universal prompt');
                });
            });
        }
        if (copyCopilotBtn) {
            copyCopilotBtn.addEventListener('click', function () {
                var report = getReport();
                if (!report)
                    return alert('No report loaded.');
                copyText(buildCopilotInstructions(report, getDomain())).then(function () {
                    flashButton(copyCopilotBtn, 'Copied ✓', 'Copilot instructions');
                });
            });
        }
        if (copyAgentsBtn) {
            copyAgentsBtn.addEventListener('click', function () {
                var report = getReport();
                if (!report)
                    return alert('No report loaded.');
                copyText(buildAgentsMdSection(report, getDomain())).then(function () {
                    flashButton(copyAgentsBtn, 'Copied ✓', 'AGENTS.md section');
                });
            });
        }
        if (copyBriefBtn) {
            copyBriefBtn.addEventListener('click', function () {
                var report = getReport();
                if (!report)
                    return alert('No report loaded.');
                copyText(formatAgentBrief(report)).then(function () {
                    flashButton(copyBriefBtn, 'Copied ✓', 'agent-brief.md');
                });
            });
        }
        if (copySuperchargeBtn) {
            copySuperchargeBtn.addEventListener('click', function () {
                var report = getReport();
                if (!report)
                    return alert('No report loaded.');
                copyText(buildSuperchargeBrief(report)).then(function () {
                    flashButton(copySuperchargeBtn, 'Copied ✓', 'agent-supercharge.md');
                });
            });
        }
        if (copyContextBtn) {
            copyContextBtn.addEventListener('click', function () {
                var report = getReport();
                if (!report)
                    return alert('No report loaded.');
                copyText(buildAiContextMarkdown(report, '', getDomain())).then(function () {
                    flashButton(copyContextBtn, 'Copied ✓', 'ai-context.md');
                });
            });
        }
        if (copyJsonBtn) {
            copyJsonBtn.addEventListener('click', function () {
                var report = getReport();
                if (!report)
                    return alert('No report loaded.');
                copyText(JSON.stringify(buildAiContextJson(report, getDomain()), null, 2)).then(function () {
                    flashButton(copyJsonBtn, 'Copied ✓', 'ai-context.json');
                });
            });
        }
        if (openSendBtn) {
            openSendBtn.addEventListener('click', function () {
                openHandoffModal();
            });
        }
    }
    function getHandoffOptionsFromUi() {
        var assistantEl = document.getElementById('sbAiHandoffAssistant');
        var focusEl = document.getElementById('sbAiHandoffFocus');
        var notesEl = document.getElementById('upload-ai-notes') || document.getElementById('sbAiHandoffNotes');
        var domainSelect = document.getElementById('aiDomainProfile');
        return {
            assistant: assistantEl ? assistantEl.value : 'generic',
            focus: focusEl ? focusEl.value : 'all',
            notes: notesEl ? notesEl.value.trim() : '',
            domainProfile: domainSelect ? domainSelect.value : getDomainProfile()
        };
    }
    function refreshHandoffPreview() {
        var preview = document.getElementById('sbAiHandoffPreview');
        var report = global.currentReport || global.lastScanReport || global.reportData;
        if (!preview || !report)
            return;
        var opts = getHandoffOptionsFromUi();
        var prompt = buildHandoffChatPrompt(report, opts);
        preview.textContent = prompt.length > 3200 ? prompt.slice(0, 3200) + '\n\n… (' + prompt.length.toLocaleString() + ' chars total — full text copied on send)' : prompt;
    }
    function openHandoffModal() {
        var modal = document.getElementById('sbAiHandoffModal');
        var report = global.currentReport || global.lastScanReport || global.reportData;
        if (!report) {
            alert('Run a scan or import a report first.');
            return;
        }
        if (!modal) {
            var legacy = document.getElementById('upload-ai-panel');
            if (legacy) {
                legacy.style.display = 'block';
                var notes = document.getElementById('upload-ai-notes');
                if (notes)
                    notes.focus();
            }
            return;
        }
        modal.hidden = false;
        document.body.classList.add('sb-ai-handoff-open');
        refreshHandoffPreview();
        var notesEl = document.getElementById('sbAiHandoffNotes');
        if (notesEl)
            notesEl.focus();
    }
    function closeHandoffModal() {
        var modal = document.getElementById('sbAiHandoffModal');
        if (modal)
            modal.hidden = true;
        document.body.classList.remove('sb-ai-handoff-open');
        var status = document.getElementById('upload-ai-status') || document.getElementById('sbAiHandoffStatus');
        if (status) {
            status.textContent = '';
            status.style.color = '';
        }
    }
    function wireHandoffModal() {
        if (global.__sbHandoffModalWired)
            return;
        global.__sbHandoffModalWired = true;
        var modal = document.getElementById('sbAiHandoffModal');
        if (!modal)
            return;
        var assistantEl = document.getElementById('sbAiHandoffAssistant');
        var focusEl = document.getElementById('sbAiHandoffFocus');
        var notesEl = document.getElementById('sbAiHandoffNotes');
        var copyBtn = document.getElementById('sbAiHandoffCopyBtn');
        var downloadBtn = document.getElementById('sbAiHandoffDownloadBtn');
        var closeBtn = document.getElementById('sbAiHandoffCloseBtn');
        var cancelBtn = document.getElementById('sbAiHandoffCancelBtn');
        var statusEl = document.getElementById('sbAiHandoffStatus');
        var backdrop = modal.querySelector('.sb-ai-handoff-modal__backdrop');
        [assistantEl, focusEl, notesEl].forEach(function (el) {
            if (el)
                el.addEventListener('input', refreshHandoffPreview);
            if (el && el.tagName === 'SELECT')
                el.addEventListener('change', refreshHandoffPreview);
        });
        function setStatus(msg, ok) {
            if (!statusEl)
                return;
            statusEl.textContent = msg;
            statusEl.style.color = ok ? 'var(--success, #10b981)' : 'var(--error, #ef4444)';
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                var report = global.currentReport || global.lastScanReport || global.reportData;
                if (!report) {
                    setStatus('No report loaded', false);
                    return;
                }
                copyBtn.disabled = true;
                copyBtn.textContent = 'Copying…';
                executeSendToAiAssistant(report, getHandoffOptionsFromUi()).then(function (res) {
                    copyBtn.disabled = false;
                    copyBtn.textContent = 'Copy handoff prompt';
                    if (res.ok) {
                        setStatus(res.message + (res.charCount ? ' (' + res.charCount.toLocaleString() + ' chars)' : ''), true);
                        flashButton(copyBtn, 'Copied ✓', 'Copy handoff prompt');
                    }
                    else {
                        setStatus(res.error || 'Copy failed', false);
                    }
                }).catch(function (err) {
                    copyBtn.disabled = false;
                    copyBtn.textContent = 'Copy handoff prompt';
                    setStatus(err.message || 'Copy failed', false);
                });
            });
        }
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function () {
                var report = global.currentReport || global.lastScanReport || global.reportData;
                if (!report) {
                    setStatus('No report loaded', false);
                    return;
                }
                var opts = getHandoffOptionsFromUi();
                downloadBtn.disabled = true;
                downloadContextPack(report, { domainProfile: opts.domainProfile, notes: opts.notes }).finally(function () {
                    downloadBtn.disabled = false;
                    setStatus('Context pack downloaded — add .simplebeacon/*.md to your repo', true);
                });
            });
        }
        if (closeBtn)
            closeBtn.addEventListener('click', closeHandoffModal);
        if (cancelBtn)
            cancelBtn.addEventListener('click', closeHandoffModal);
        if (backdrop)
            backdrop.addEventListener('click', closeHandoffModal);
        document.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape' && modal && !modal.hidden)
                closeHandoffModal();
        });
    }
    function wireSendToAiButtons() {
        if (global.__sbSendToAiWired)
            return;
        global.__sbSendToAiWired = true;
        global.__simplebeaconSetReportForAI = function (report) {
            global.currentReport = report;
        };
        var sendBtn = document.getElementById('upload-send-ai-btn');
        var analyzeSendBtn = document.getElementById('analyze-send-ai-btn');
        var aiConfirm = document.getElementById('upload-ai-confirm');
        var aiCancel = document.getElementById('upload-ai-cancel');
        var aiPanel = document.getElementById('upload-ai-panel');
        var aiStatus = document.getElementById('upload-ai-status');
        var tokenRow = document.getElementById('tokenActionRow');
        if (tokenRow && sendBtn) {
            var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (m) {
                    if (m.type === 'attributes' && m.attributeName === 'style') {
                        if (tokenRow.style.display !== 'none')
                            sendBtn.style.display = 'block';
                    }
                });
            });
            observer.observe(tokenRow, { attributes: true, attributeFilter: ['style'] });
        }
        if (sendBtn) {
            sendBtn.addEventListener('click', function () { openHandoffModal(); });
        }
        if (analyzeSendBtn) {
            analyzeSendBtn.addEventListener('click', function () {
                var vscode = getVsCodeApiCached();
                if (vscode) {
                    var report = global.currentReport || global.lastScanReport;
                    if (!report) {
                        alert('No scan report to send');
                        return;
                    }
                    executeSendToAiAssistant(report, { preferVsCode: true }).then(function (res) {
                        if (res.ok) {
                            analyzeSendBtn.textContent = 'Sent ✓';
                            setTimeout(function () { analyzeSendBtn.textContent = '🤖 Send to AI Slop Cop'; }, 2000);
                        }
                    });
                    return;
                }
                openHandoffModal();
            });
        }
        if (aiConfirm) {
            aiConfirm.addEventListener('click', function () {
                var report = global.currentReport || global.lastScanReport;
                if (!report) {
                    if (aiStatus) {
                        aiStatus.textContent = 'No report loaded';
                        aiStatus.style.color = 'var(--error)';
                    }
                    return;
                }
                aiConfirm.disabled = true;
                aiConfirm.textContent = 'Copying…';
                executeSendToAiAssistant(report, getHandoffOptionsFromUi()).then(function (res) {
                    aiConfirm.disabled = false;
                    aiConfirm.textContent = 'Copy handoff prompt';
                    if (res.ok && aiStatus) {
                        aiStatus.textContent = res.message;
                        aiStatus.style.color = 'var(--success)';
                    }
                    else if (aiStatus) {
                        aiStatus.textContent = res.error || 'Failed';
                        aiStatus.style.color = 'var(--error)';
                    }
                });
            });
        }
        if (aiCancel && aiPanel) {
            aiCancel.addEventListener('click', function () {
                aiPanel.style.display = 'none';
                closeHandoffModal();
            });
        }
    }
    global.SbAiContextPack = {
        formatAgentBrief: formatAgentBrief,
        buildAiContextMarkdown: buildAiContextMarkdown,
        buildUniversalPrompt: buildUniversalPrompt,
        buildCursorPrompt: buildCursorPrompt,
        buildCopilotInstructions: buildCopilotInstructions,
        buildAgentsMdSection: buildAgentsMdSection,
        buildAiContextJson: buildAiContextJson,
        enrichReportForAi: enrichReportForAi,
        extractCollectedInsights: extractCollectedInsights,
        buildSendToAiPayload: buildSendToAiPayload,
        buildHandoffChatPrompt: buildHandoffChatPrompt,
        executeSendToAiAssistant: executeSendToAiAssistant,
        sanitizeSuggestedFixes: sanitizeSuggestedFixes,
        downloadContextPack: downloadContextPack,
        renderSuggestedFixes: renderSuggestedFixes,
        openHandoffModal: openHandoffModal,
        closeHandoffModal: closeHandoffModal,
        wireSendToAiButtons: wireSendToAiButtons,
        MCP_RULE_SNIPPET: MCP_RULE_SNIPPET
    };
    global.sbRenderAiContextPack = sbRenderAiContextPack;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            wireAuditAiContextPackUi();
            wireHandoffModal();
            wireSendToAiButtons();
        });
    }
    else {
        wireAuditAiContextPackUi();
        wireHandoffModal();
        wireSendToAiButtons();
    }
})(typeof window !== 'undefined' ? window : global);
