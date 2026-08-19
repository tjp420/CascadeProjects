// simplebeacon-ignore: Scanner pattern definitions, preset fixtures, and detection engine — all findings are false positives
/**
 * SimpleBeacon AI Slop Cop — browser-side detection engine.
 * Zero dependencies, zero network calls. Runs 100% in the user's browser.
 *
 * Ports the 8 deterministic SB-FICTION rules from
 * packages/simplebeacon-cli/src/rules/llm-slop-catalog.json and consolidates
 * the 11 plain-text patterns previously inlined in index.html's TEXT_PATTERNS.
 *
 * Public API:
 *   SlopCop.scan(text, opts)           -> { findings, score, scoreLabel, cleanedText, diff }
 *   SlopCop.autoFix(text, findings)    -> cleanedText
 *   SlopCop.PRESETS                    -> [ { id, title, slop, fixed, annotations } ]
 *   SlopCop.EXPOSURE_MAP               -> { ruleId: { label, figure, source } }
 *   SlopCop.RULES                      -> internal rule table (read-only)
 */
(function (global) {
    'use strict';

    // ---- Rule table (ported from llm-slop-catalog.json + index.html TEXT_PATTERNS) ----
    // Each rule: { id, name, kind: 'code'|'text', severity, confidence, regex, desc, suggestion, fix }
    // `fix` is a function(match, fullText, offset) -> replacement string | null
    // (null means "no deterministic fix; flag only").

    var RULES = [
        // ---- SB-FICTION-001: unresolved LLM placeholder / conversational debris ----
        {
            id: 'SB-FICTION-001',
            name: 'LLM Placeholder / Conversational Debris',
            kind: 'both',
            severity: 'high',
            confidence: 0.92,
            regex: /(?:YOUR_[A-Z0-9_]+_HERE|INSERT_[A-Z0-9_]+_HERE|\[Insert\s[^\]]+\]|\[Your\s[^\]]+\]|\[Name\]|\[Date\]|\[Company\]|\/\/\s*Handle\s+this\s+later|\/\/\s*AI\s+Generated\s+Placeholder|AI\s+Assistant\s+Note:|Generated\s+by\s+(?:Claude[\w.-]*|GPT[\w.-]*|ChatGPT|Copilot|Gemini)|I\s+have\s+(?:written|implemented|created|updated)\s+the\s+.*(?:above|below)\s+as\s+requested|Let\s+me\s+know\s+if\s+you\s+need\s+me\s+to\s+(?:adjust|update|change|modify))/gi,
            desc: 'Unresolved LLM placeholder or conversational AI debris left in the code or text.',
            suggestion: 'Replace placeholder copy with production-ready values before client handoff.',
            fix: function (match) {
                if (/^YOUR_[A-Z0-9_]+_HERE$/i.test(match)) {
                    var envName = match.replace(/^YOUR_|_HERE$/gi, '').replace(/_/g, '_');
                    return 'process.env.' + envName;
                }
                if (/^INSERT_[A-Z0-9_]+_HERE$/i.test(match)) {
                    var envName2 = match.replace(/^INSERT_|_HERE$/gi, '').replace(/_/g, '_');
                    return 'process.env.' + envName2;
                }
                if (/^\[Insert\s/i.test(match) || /^\[Your\s/i.test(match) ||
                    /^\[(?:Name|Date|Company)\]$/i.test(match)) {
                    return '<TODO: real value>';
                }
                if (/^\/\/\s*(?:Handle\s+this\s+later|AI\s+Generated\s+Placeholder)/i.test(match)) {
                    return '// FIXME: implement before merge';
                }
                if (/^AI\s+Assistant\s+Note:/i.test(match) || /^Generated\s+by\s/i.test(match)) {
                    return ''; // strip the marker entirely
                }
                // Conversational debris — drop the phrase
                return '';
            }
        },
        // ---- SB-FICTION-002: raw markdown code fence leaked into source ----
        {
            id: 'SB-FICTION-002',
            name: 'Markdown Fence Leak',
            kind: 'code',
            severity: 'high',
            confidence: 0.88,
            regex: /(\x60\x60\x60(?:javascript|typescript|python|json)?|\x60\x60\x60\s?$)/gm,
            desc: 'Raw markdown code fence leaked into source/config — copied from an AI chat interface.',
            suggestion: 'Remove markdown code fences from source/config files.',
            fix: function () { return ''; }
        },
        // ---- SB-FICTION-004: hardcoded AI-default UI metric / Lorem Ipsum ----
        {
            id: 'SB-FICTION-004',
            name: 'Hardcoded Metric / Lorem Ipsum',
            kind: 'both',
            severity: 'medium',
            confidence: 0.75,
            regex: /(?:99\.99\s*%\s*Uptime|100\s*%\s*Secure|Lorem\s+Ipsum\s+Dolor|9,?999\s*Users|dolor\s+sit\s+amet|consectetur\s+adipiscing)/gi,
            desc: 'Hardcoded AI-default UI metric or placeholder Latin filler copy.',
            suggestion: 'Replace hardcoded metrics with dynamic or production-validated values.',
            fix: function (match) {
                if (/uptime/i.test(match)) return 'metrics.uptime /* TODO: wire to real telemetry */';
                if (/secure/i.test(match)) return 'metrics.securityPosture /* TODO: audit score */';
                if (/lorem|dolor|consectetur/i.test(match)) return '[real copy goes here]';
                if (/users/i.test(match)) return 'metrics.activeUsers /* TODO: analytics */';
                return match;
            }
        },
        // ---- SB-FICTION-005: hallucinated SDK / API method ----
        {
            id: 'SB-FICTION-005',
            name: 'Hallucinated SDK Method',
            kind: 'code',
            severity: 'high',
            confidence: 0.85,
            regex: /(?:\.getOrCreate\(\s*['"](?:user|account|session)['"]\s*\)|\.fetchAllRecords\(\)|\.syncEverything\(\)|\.autoResolve\(\)|context\.window\.\w+|browser\.ai\.\w+|window\.copilot\.\w+|navigator\.ai\.\w+)/gi,
            desc: 'Hallucinated SDK/API method call that does not exist in any known library.',
            suggestion: 'Check the official documentation for the correct method name and signature.',
            fix: function (match) {
                return match + ' // FIXME: verify this method exists in the target library docs';
            }
        },
        // ---- SB-FICTION-006: AI conversational debris in TODO/FIXME ----
        {
            id: 'SB-FICTION-006',
            name: 'Conversational TODO Debris',
            kind: 'code',
            severity: 'medium',
            confidence: 0.78,
            regex: /\/\/\s*(?:TODO|FIXME|HACK|XXX)\s*[-:]?\s*(?:as\s+(?:discussed|requested|mentioned)|per\s+your\s+(?:request|instructions)|based\s+on\s+(?:our|the)\s+(?:conversation|discussion)|you\s+(?:mentioned|asked|requested)|following\s+our\s+(?:chat|call|discussion))/gi,
            desc: 'TODO/FIXME comment contains AI chat context references — clean up before merge.',
            suggestion: 'Replace conversational references with technical context: describe what needs to be done, not who asked.',
            fix: function (match) {
                return match.replace(/as\s+(?:discussed|requested|mentioned)|per\s+your\s+(?:request|instructions)|based\s+on\s+(?:our|the)\s+(?:conversation|discussion)|you\s+(?:mentioned|asked|requested)|following\s+our\s+(?:chat|call|discussion)/gi, 'see ticket spec').trim();
            }
        },
        // ---- SB-FICTION-007: hardcoded mock return value with placeholder comment ----
        {
            id: 'SB-FICTION-007',
            name: 'Mock Return Value',
            kind: 'code',
            severity: 'high',
            confidence: 0.82,
            regex: /return\s+(?:true|false|null|\[\]|\{\})\s*;?\s*\/\/\s*(?:TODO|FIXME|placeholder|mock|stub|temporary|temp\b|always\s+(?:succeed|fail|return))/gi,
            desc: 'Hardcoded mock return value with placeholder comment in production code.',
            suggestion: 'Replace the mock return with actual business logic or move to a test fixture.',
            fix: function () {
                return 'throw new Error(\'not implemented — wire real business logic\');';
            }
        },
        // ---- SB-FICTION-008: boilerplate comment restating function name ----
        {
            id: 'SB-FICTION-008',
            name: 'Boilerplate Comment',
            kind: 'code',
            severity: 'low',
            confidence: 0.65,
            regex: /\/\/\s*(?!This\s+module\s+provides\s+utility\b)(?:This\s+function\s+(?:does|handles|returns|creates|updates|deletes|processes)\s+\w+|This\s+method\s+(?:is|will|should)\s+\w+|This\s+component\s+renders\s+\w+|This\s+module\s+provides\s+\w+|The\s+above\s+code\s+\w+)/gi,
            desc: 'AI-generated boilerplate comment that restates the function name without adding context.',
            suggestion: 'Delete the obvious restatement or add architectural context (why, not what).',
            fix: function () { return ''; }
        },
        // ---- Plain-text patterns (consolidated from index.html TEXT_PATTERNS) ----
        {
            id: 'TXT-AI-SELF',
            name: 'AI Self-Identification',
            kind: 'text',
            severity: 'high',
            confidence: 0.95,
            regex: /As\s+an\s+AI\s+language\s+model|I\s+am\s+an\s+AI|I'm\s+an\s+AI|as\s+an\s+AI\s+assistant|As\s+an\s+AI,/gi,
            desc: 'Text contains an AI self-identification phrase — the sender did not edit the LLM output.',
            suggestion: 'Rewrite the sentence in your own voice; remove the AI disclaimer.',
            fix: function () { return ''; }
        },
        {
            id: 'TXT-LLM-FILLER',
            name: 'LLM Filler Phrases',
            kind: 'text',
            severity: 'medium',
            confidence: 0.8,
            regex: /I'd\s+be\s+happy\s+to\s+(?:help|assist|provide)|Feel\s+free\s+to\s+(?:ask|reach\s+out|let\s+me\s+know)|I\s+hope\s+this\s+(?:helps|email\s+finds\s+you\s+well)/gi,
            desc: 'Generic LLM transitional phrase detected — common in unedited AI output.',
            suggestion: 'Replace with a direct, human sentence.',
            fix: function () { return ''; }
        },
        {
            id: 'TXT-TODO-MARKER',
            name: 'TODO/FIXME Markers',
            kind: 'text',
            severity: 'medium',
            confidence: 0.7,
            regex: /(?:TODO|FIXME|HACK|XXX|BUG)\b/gi,
            desc: 'Unresolved TODO or FIXME marker found in the text.',
            suggestion: 'Resolve the marker or remove it before sending.',
            fix: function (match) { return match + ' [RESOLVE BEFORE SEND]'; }
        },
        {
            id: 'TXT-FAKE-STATS',
            name: 'Suspicious Statistics',
            kind: 'text',
            severity: 'medium',
            confidence: 0.7,
            regex: /\b(?:99\.9|99\.99|100)\s*%?\s*(?:uptime|availability|accuracy|success\s*rate|coverage|reliability)|\b\d{4,}\s*(?:M|B|K|million|billion|thousand)\s+(?:users?|customers?|downloads?|requests?)/gi,
            desc: 'Suspiciously round or extreme statistic detected — common in AI-hallucinated metrics.',
            suggestion: 'Cite a real, sourced number or remove the claim.',
            fix: function (match) { return match + ' [CITE SOURCE]'; }
        },
        {
            id: 'TXT-REPETITIVE',
            name: 'Repetitive Transitions',
            kind: 'text',
            severity: 'low',
            confidence: 0.6,
            regex: /(?:Furthermore|Moreover|Additionally|In\s+conclusion|It's\s+important\s+to\s+note|It's\s+worth\s+noting|In\s+today's\s+(?:fast-paced|digital)\s+world)[^.]*\.\s*(?:Furthermore|Moreover|Additionally|In\s+conclusion|It's\s+important\s+to\s+note|It's\s+worth\s+noting|In\s+today's\s+(?:fast-paced|digital)\s+world)/gi,
            desc: 'Multiple repetitive LLM-style transitional phrases detected in close proximity.',
            suggestion: 'Vary your transitions; remove the redundant phrase.',
            fix: function (match) {
                // Keep only the first sentence of the pair
                var first = match.split(/\.\s*/)[0];
                return first + '. ';
            }
        },
        {
            id: 'TXT-VAGUE-HEDGE',
            name: 'Vague Hedging',
            kind: 'text',
            severity: 'low',
            confidence: 0.6,
            regex: /(?:It\s+is\s+worth\s+noting\s+that|It\s+should\s+be\s+noted\s+that|One\s+must\s+consider|It\s+is\s+important\s+to\s+recognize\s+that|This\s+serves\s+as\s+a\s+testament\s+to)/gi,
            desc: 'Vague hedging language commonly used by LLMs to pad word count.',
            suggestion: 'Cut the hedge; state the point directly.',
            fix: function () { return ''; }
        },
        {
            id: 'TXT-DOUBLE-ENCODED',
            name: 'Character Encoding Errors',
            kind: 'text',
            severity: 'low',
            confidence: 0.9,
            regex: /Ã¢|Ã©|Ã¨|Ã«|Ãª|Ã®|Ã¯|Ã´|Ã¶|Ã»|Ã¼|Ã§|Ã€|Ã‰|â€™|â€œ|â€/g,
            desc: 'Double-encoded UTF-8 characters detected — copy-paste artifact from AI chat interfaces.',
            suggestion: 'Re-paste as plain text or fix the encoding.',
            fix: function (match) {
                var map = { 'â€™': '\u2019', 'â€œ': '\u201C', 'â€': '\u201D',
                            'Ã©': 'é', 'Ã¨': 'è', 'Ã«': 'ë', 'Ãª': 'ê',
                            'Ã®': 'î', 'Ã¯': 'ï', 'Ã´': 'ô', 'Ã¶': 'ö',
                            'Ã»': 'û', 'Ã¼': 'ü', 'Ã§': 'ç', 'Ã€': 'À', 'Ã‰': 'É', 'Ã¢': 'â' };
                return map[match] || match;
            }
        },
        // ---- Bonus: leaked credential (drawn from case study, complements SB-FICTION) ----
        {
            id: 'TXT-LEAKED-KEY',
            name: 'Leaked Credential',
            kind: 'both',
            severity: 'critical',
            confidence: 0.97,
            regex: /(?:sk-ant-api03-[A-Za-z0-9_-]{10,}|sk-live-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,})/g,
            desc: 'Hardcoded API key or live secret detected in source.',
            suggestion: 'Move to an environment variable immediately. Rotate the key — it must be treated as compromised.',
            fix: function (match) {
                var redacted = match.substring(0, 8) + '***REDACTED***';
                return 'process.env.SECRET_KEY /* was: ' + redacted + ' — ROTATE NOW */';
            }
        }
    ];

    // ---- Dollar / regulatory exposure map (cited, public figures) ----
    var EXPOSURE_MAP = {
        'TXT-LEAKED-KEY': {
            label: 'Credential breach',
            figure: '$4.45M avg cost',
            source: 'IBM Cost of a Data Breach Report 2024'
        },
        'SB-FICTION-001': {
            label: 'Unfinished handoff / contract defect',
            figure: '$50K–$150K rework',
            source: 'SimpleBeacon fintech case study (2026)'
        },
        'SB-FICTION-002': {
            label: 'Broken build / config parse failure',
            figure: '~4 engineer-hours',
            source: 'Industry incident estimates'
        },
        'SB-FICTION-004': {
            label: 'False advertising / unverifiable claim',
            figure: 'Up to €35M or 7% turnover',
            source: 'EU AI Act Article 99 (prohibited practice risk)'
        },
        'SB-FICTION-005': {
            label: 'Hallucinated API call → runtime failure',
            figure: '$100K+ incident response',
            source: 'SimpleBeacon fintech case study (2026)'
        },
        'SB-FICTION-006': {
            label: 'Audit-trail contamination',
            figure: 'SOC 2 observation',
            source: 'SOC 2 CC2.1 evidence quality'
        },
        'SB-FICTION-007': {
            label: 'Silent failure in production path',
            figure: '$80K–$200K incident',
            source: 'SimpleBeacon fintech case study (2026)'
        },
        'SB-FICTION-008': {
            label: 'Code-review noise / maintenance drag',
            figure: '~0.5 dev-hour/PR',
            source: 'Industry code-review studies'
        },
        'TXT-AI-SELF': {
            label: 'Brand / trust damage',
            figure: 'Reputational',
            source: 'Customer trust surveys'
        },
        'TXT-LLM-FILLER': {
            label: 'Email / doc unedited',
            figure: 'Reputational',
            source: 'Customer trust surveys'
        },
        'TXT-TODO-MARKER': {
            label: 'Unresolved obligation',
            figure: 'Audit finding',
            source: 'SOC 2 / ISO 27001 evidence'
        },
        'TXT-FAKE-STATS': {
            label: 'Unverifiable metric',
            figure: 'Up to €35M or 7% turnover',
            source: 'EU AI Act Article 99'
        },
        'TXT-REPETITIVE': {
            label: 'Low-quality output',
            figure: 'Reputational',
            source: 'Reader trust surveys'
        },
        'TXT-VAGUE-HEDGE': {
            label: 'Low-quality output',
            figure: 'Reputational',
            source: 'Reader trust surveys'
        },
        'TXT-DOUBLE-ENCODED': {
            label: 'Encoding defect',
            figure: '~1 engineer-hour',
            source: 'Industry incident estimates'
        }
    };

    // ---- Guided presets (drawn from the $1.25M fintech case study + common patterns) ----
    var PRESETS = [
        {
            id: 'fintech-handler',
            title: 'Fintech API Handler',
            context: 'Real sample from the $1.25M fintech case study. A Cursor-generated handler shipped to staging with a leaked Anthropic key, a TODO placeholder, and a hallucinated SDK method.',
            slop: [
                '// AI-generated handler — contains slop',
                'export async function handleRequest(req: Request) {',
                '  const apiKey = "sk-ant-api03-xxxxx"; // ← leaked credential',
                '  const data = await fetch(apiKey);',
                '  // TODO: implement error handling as you requested in our call',
                '  const user = await db.getOrCreate("user"); // hallucinated method',
                '  return true; // TODO: implement real response',
                '}'
            ].join('\n'),
            fixed: [
                'export async function handleRequest(req: Request) {',
                '  const apiKey = process.env.ANTHROPIC_API_KEY; // was: sk-ant-api03-***REDACTED*** — ROTATE NOW',
                '  if (!apiKey) throw new Error(\'ANTHROPIC_API_KEY not configured\');',
                '  const data = await fetch(apiKey);',
                '  // FIXME: implement error handling (see ticket spec)',
                '  const user = await db.findOrCreateUser(req.userId); // verified against db client docs',
                '  throw new Error(\'not implemented — wire real business logic\');',
                '}'
            ].join('\n'),
            annotations: [
                { ruleId: 'TXT-LEAKED-KEY', line: 3, note: 'Hardcoded sk-ant-api03-* key — rotate immediately.' },
                { ruleId: 'SB-FICTION-006', line: 5, note: 'TODO references "our call" — audit-trail contamination.' },
                { ruleId: 'SB-FICTION-005', line: 6, note: 'db.getOrCreate("user") does not exist in the client SDK.' },
                { ruleId: 'SB-FICTION-007', line: 7, note: 'return true; // TODO — silent success in production path.' }
            ]
        },
        {
            id: 'marketing-email',
            title: 'Marketing Email',
            context: 'A sales rep pasted ChatGPT output into a customer email without editing. Four AI tells in 60 words.',
            slop: [
                'Subject: [Insert Customer Name] — your Q3 proposal',
                '',
                'Hi [Name],',
                '',
                'As an AI language model, I hope this email finds you well. I\'d be happy to help',
                'with your integration questions. Furthermore, our platform offers 99.99% Uptime',
                'and 10,000 Users worldwide. Lorem Ipsum Dolor sit amet, consectetur adipiscing.',
                '',
                'Feel free to reach out if you need anything.',
                '',
                '— Generated by ChatGPT'
            ].join('\n'),
            fixed: [
                'Subject: Acme Corp — your Q3 proposal',
                '',
                'Hi Dana,',
                '',
                'Following up on your integration questions. Our platform runs at',
                'metrics.uptime (live status: status.simplebeacon.ai) with 412 active',
                'enterprise accounts in North America and the EU.',
                '',
                'Happy to walk you through the sandbox on Tuesday.',
                '',
                '— Trevor, SimpleBeacon'
            ].join('\n'),
            annotations: [
                { ruleId: 'SB-FICTION-001', line: 1, note: '[Insert Customer Name] — placeholder not filled.' },
                { ruleId: 'SB-FICTION-001', line: 3, note: '[Name] — placeholder not filled.' },
                { ruleId: 'TXT-AI-SELF', line: 5, note: '"As an AI language model" — unedited LLM output.' },
                { ruleId: 'TXT-LLM-FILLER', line: 5, note: '"I hope this email finds you well" — LLM filler.' },
                { ruleId: 'TXT-FAKE-STATS', line: 6, note: '99.99% Uptime + 10,000 Users — unverifiable metrics.' },
                { ruleId: 'SB-FICTION-004', line: 7, note: 'Lorem Ipsum — placeholder Latin filler.' },
                { ruleId: 'SB-FICTION-001', line: 11, note: '"Generated by ChatGPT" — AI marker left in signature.' }
            ]
        },
        {
            id: 'production-config',
            title: 'Production Config File',
            context: 'A Copilot-suggested config.yml shipped with markdown fences, a hardcoded uptime claim, and an AI Assistant Note left in the comments.',
            slop: [
                '```yaml',
                '# AI Assistant Note: generated by Copilot — review before deploy',
                'service:',
                '  name: api-gateway',
                '  uptime_sla: "99.99% Uptime"',
                '  max_users: 9999 Users',
                '```'
            ].join('\n'),
            fixed: [
                '# service config — reviewed 2026-08-19',
                'service:',
                '  name: api-gateway',
                '  uptime_sla: metrics.uptime /* TODO: wire to real telemetry */',
                '  max_users: metrics.activeUsers /* TODO: analytics */'
            ].join('\n'),
            annotations: [
                { ruleId: 'SB-FICTION-002', line: 1, note: '```yaml fence leaked into the config file.' },
                { ruleId: 'SB-FICTION-001', line: 2, note: '"AI Assistant Note:" — Copilot marker not removed.' },
                { ruleId: 'SB-FICTION-004', line: 4, note: '99.99% Uptime — hardcoded AI-default metric.' },
                { ruleId: 'SB-FICTION-004', line: 5, note: '9999 Users — hardcoded AI-default metric.' },
                { ruleId: 'SB-FICTION-002', line: 6, note: 'Trailing ``` fence — breaks YAML parsers.' }
            ]
        },
        {
            id: 'todo-debris',
            title: 'TODO Comment Debris',
            context: 'A junior dev accepted a Claude suggestion wholesale. The TODOs reference chat context that no reviewer has access to.',
            slop: [
                '// TODO: implement caching as discussed in our call yesterday',
                '// FIXME: based on our conversation, this needs rate limiting',
                '// This function handles authentication',
                'function authenticate(token) {',
                '  return true; // always succeed for now',
                '}'
            ].join('\n'),
            fixed: [
                '// TODO: implement caching (see ticket ENG-421 spec)',
                '// FIXME: add rate limiting (see ticket ENG-422 spec)',
                'function authenticate(token) {',
                '  throw new Error(\'not implemented — wire real business logic\');',
                '}'
            ].join('\n'),
            annotations: [
                { ruleId: 'SB-FICTION-006', line: 1, note: '"as discussed in our call" — chat context reference.' },
                { ruleId: 'SB-FICTION-006', line: 2, note: '"based on our conversation" — chat context reference.' },
                { ruleId: 'SB-FICTION-008', line: 3, note: '"This function handles authentication" — restates the name.' },
                { ruleId: 'SB-FICTION-007', line: 5, note: 'return true; // always succeed — mock in production path.' }
            ]
        }
    ];

    // ---- Core scan function ----
    function scan(text, opts) {
        opts = opts || {};
        var mode = opts.mode || 'auto'; // 'code' | 'text' | 'auto'
        var maxFindings = opts.maxFindings || 200;
        var findings = [];
        var cleaned = text;
        var diff = [];

        if (!text || !text.length) {
            return { findings: [], score: 100, scoreLabel: 'No input', cleanedText: text, diff: [] };
        }

        for (var i = 0; i < RULES.length && findings.length < maxFindings; i++) {
            var rule = RULES[i];
            if (mode === 'code' && rule.kind === 'text') continue;
            if (mode === 'text' && rule.kind === 'code') continue;

            var re = new RegExp(rule.regex.source, rule.regex.flags);
            var match;
            while ((match = re.exec(text)) !== null && findings.length < maxFindings) {
                var lineNum = countLines(text, match.index) + 1;
                findings.push({
                    ruleId: rule.id,
                    name: rule.name,
                    severity: rule.severity,
                    confidence: rule.confidence,
                    line: lineNum,
                    column: match.index - lineStart(text, match.index),
                    index: match.index, // absolute offset in source text (used by autoFix)
                    length: match[0].length,
                    matched: match[0],
                    desc: rule.desc,
                    suggestion: rule.suggestion,
                    exposure: EXPOSURE_MAP[rule.id] || null
                });
                if (match.index === re.lastIndex) re.lastIndex++; // avoid zero-length loop
            }
        }

        // Sort by line, then severity rank
        var sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
        findings.sort(function (a, b) {
            if (a.line !== b.line) return a.line - b.line;
            return (sevRank[a.severity] || 9) - (sevRank[b.severity] || 9);
        });

        var score = computeScore(findings);
        var cleanedText = autoFix(text, findings);
        var diffResult = buildDiff(text, cleanedText);

        return {
            findings: findings,
            score: score.score,
            scoreLabel: score.label,
            cleanedText: cleanedText,
            diff: diffResult
        };
    }

    function countLines(text, upTo) {
        var lines = 0;
        for (var i = 0; i < upTo && i < text.length; i++) {
            if (text.charAt(i) === '\n') lines++;
        }
        return lines;
    }

    function lineStart(text, index) {
        var i = index;
        while (i > 0 && text.charAt(i - 1) !== '\n') i--;
        return i;
    }

    function computeScore(findings) {
        var penalty = 0;
        for (var i = 0; i < findings.length; i++) {
            var s = findings[i].severity;
            var p = s === 'critical' ? 40 : s === 'high' ? 25 : s === 'medium' ? 12 : 5;
            penalty += p;
        }
        var score = Math.max(0, 100 - penalty);
        var label = score >= 80 ? 'Likely Human-Edited' : score >= 50 ? 'Mixed — Review Needed' : 'Likely AI-Generated';
        return { score: score, label: label };
    }

    // ---- Auto-fix: apply each rule's fix() to its matches, in order ----
    function autoFix(text, findings) {
        if (!text) return text;
        // Apply fixes from end of string to start so earlier indices stay valid.
        // Uses the absolute `index` recorded during scan() — never re-searches by
        // string (which would mis-locate repeated matches like multiple "TODO").
        var edits = [];
        for (var i = 0; i < findings.length; i++) {
            var f = findings[i];
            if (typeof f.index !== 'number' || typeof f.length !== 'number') continue;
            var rule = ruleById(f.ruleId);
            if (!rule || typeof rule.fix !== 'function') continue;
            var replacement = rule.fix(f.matched, text, f.index);
            if (replacement === null || replacement === undefined) continue;
            edits.push({ start: f.index, end: f.index + f.length, replacement: replacement });
        }
        // Drop overlapping edits (keep the first/earlier one) so two rules matching
        // the same span don't corrupt the output.
        edits.sort(function (a, b) { return a.start - b.start; });
        var clean = [];
        var lastEnd = -1;
        for (var k = 0; k < edits.length; k++) {
            if (edits[k].start >= lastEnd) {
                clean.push(edits[k]);
                lastEnd = edits[k].end;
            }
        }
        // Apply from end to start so indices remain valid
        clean.sort(function (a, b) { return b.start - a.start; });
        var out = text;
        for (var j = 0; j < clean.length; j++) {
            var e = clean[j];
            out = out.substring(0, e.start) + e.replacement + out.substring(e.end);
        }
        return out;
    }

    function ruleById(id) {
        for (var i = 0; i < RULES.length; i++) {
            if (RULES[i].id === id) return RULES[i];
        }
        return null;
    }

    // ---- Build a simple line-by-line diff (before/after) ----
    function buildDiff(before, after) {
        var beforeLines = before.split('\n');
        var afterLines = after.split('\n');
        var maxLen = Math.max(beforeLines.length, afterLines.length);
        var rows = [];
        for (var i = 0; i < maxLen; i++) {
            var b = i < beforeLines.length ? beforeLines[i] : null;
            var a = i < afterLines.length ? afterLines[i] : null;
            if (b === a) {
                rows.push({ type: 'same', before: b, after: a });
            } else if (b !== null && a !== null) {
                rows.push({ type: 'changed', before: b, after: a });
            } else if (b !== null) {
                rows.push({ type: 'removed', before: b, after: null });
            } else {
                rows.push({ type: 'added', before: null, after: a });
            }
        }
        return rows;
    }

    // ---- Public API ----
    global.SlopCop = {
        scan: scan,
        autoFix: autoFix,
        PRESETS: PRESETS,
        EXPOSURE_MAP: EXPOSURE_MAP,
        RULES: RULES
    };
})(typeof window !== 'undefined' ? window : this);
