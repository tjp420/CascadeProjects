// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
/** Terminal Scan Simulation — inlined version for index.html */
(function () {
    const term = document.getElementById('twBody');
    const startBtn = document.getElementById('twStartBtn');
    const resetBtn = document.getElementById('twResetBtn');
    const skipLink = document.getElementById('twSkipLink');

    let typeSpeed = 40;
    let running = false;
    let cancelled = false;

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    function htmlToFragment(html) {
        return document.createRange().createContextualFragment(html.trim());
    }

    function appendLine(html, className = '') {
        const div = document.createElement('div');
        div.className = 'tw-line ' + className;
        div.appendChild(htmlToFragment(html));
        term.appendChild(div);
        term.scrollTop = term.scrollHeight;
    }

    function appendRaw(html) {
        const div = document.createElement('div');
        div.className = 'tw-line';
        div.appendChild(htmlToFragment(html));
        term.appendChild(div);
        term.scrollTop = term.scrollHeight;
    }

    async function typeLineWithPrefix(prefix, text, className = '') {
        const div = document.createElement('div');
        div.className = 'tw-line ' + className;
        const span = document.createElement('span');
        span.className = 'tw-prompt';
        span.textContent = prefix;
        div.appendChild(span);
        term.appendChild(div);
        for (let i = 0; i < text.length; i++) {
            if (cancelled) return;
            const tspan = document.createElement('span');
            tspan.textContent = text[i];
            div.appendChild(tspan);
            term.scrollTop = term.scrollHeight;
            await sleep(typeSpeed);
        }
    }

    async function typeLine(text, className = '') {
        const div = document.createElement('div');
        div.className = 'tw-line ' + className;
        term.appendChild(div);
        for (let i = 0; i < text.length; i++) {
            if (cancelled) return;
            div.textContent += text[i];
            term.scrollTop = term.scrollHeight;
            await sleep(typeSpeed);
        }
    }

    async function typeHTML(html, delay = 0) {
        const div = document.createElement('div');
        div.className = 'tw-line';
        div.appendChild(htmlToFragment(html));
        term.appendChild(div);
        term.scrollTop = term.scrollHeight;
        if (delay > 0) await sleep(delay);
    }

    const SCENARIOS = [
        {
            cmd: 'npx simplebeacon scan --gate',
            files: 347,
            findings: [
                {
                    sev: 'high',
                    type: 'Credential Pattern',
                    file: 'src/config/prod.js',
                    line: 14,
                    msg: 'Stripe live key sk_live_... detected in source'
                },
                {
                    sev: 'high',
                    type: 'Hallucinated Import',
                    file: 'src/utils/ai-helpers.js',
                    line: 3,
                    msg: "import { magicParser } from 'npm-magic-parser-99' — not in package.json"
                },
                {
                    sev: 'medium',
                    type: 'AI Slop / Boilerplate',
                    file: 'src/services/api.ts',
                    line: 22,
                    msg: 'Identical JSDoc block found in 8 other files'
                },
                {
                    sev: 'medium',
                    type: 'Placeholder Secret',
                    file: 'src/auth/token.ts',
                    line: 7,
                    msg: "const API_KEY = 'SB-DEMO-xxxxxxxxxxxxxxxx'"
                }, // simplebeacon-ignore credential-pattern — simulated scan output data, not real credentials
                {
                    sev: 'low',
                    type: 'Generic Error Swallowing',
                    file: 'src/handlers/error.js',
                    line: 45,
                    msg: 'catch(e){ /* TODO */ } — error silently dropped'
                },
                {
                    sev: 'low',
                    type: 'Unused Variable',
                    file: 'src/components/Dashboard.tsx',
                    line: 12,
                    msg: 'xyz_var declared but never used (AI hallucination pattern)'
                }
            ]
        },
        {
            cmd: 'npx simplebeacon scan --profile minimal',
            files: 347,
            findings: [
                {
                    sev: 'high',
                    type: 'Credential Pattern',
                    file: 'server/config.env',
                    line: 3,
                    msg: 'AWS access key AKIA... detected'
                },
                {
                    sev: 'high',
                    type: 'Credential Pattern',
                    file: 'docker-compose.yml',
                    line: 18,
                    msg: 'Database password in plaintext'
                }
            ]
        },
        {
            cmd: 'npx simplebeacon scan --complete --gate',
            files: 1247,
            findings: [
                {
                    sev: 'critical',
                    type: 'Production Leak',
                    file: 'public/js/analytics.js',
                    line: 1,
                    msg: 'Mixpanel token sent to unknown domain'
                },
                {
                    sev: 'high',
                    type: 'EU AI Act Indicator',
                    file: 'src/ai/generate.js',
                    line: 8,
                    msg: 'Generative AI system without transparency notice'
                },
                {
                    sev: 'high',
                    type: 'Architecture Drift',
                    file: 'src/legacy/v1-api.js',
                    line: 200,
                    msg: '500-line function violates service boundary'
                },
                {
                    sev: 'medium',
                    type: 'Token Bleed',
                    file: 'src/auth/oauth.ts',
                    line: 34,
                    msg: 'OAuth refresh token logged to console'
                },
                {
                    sev: 'medium',
                    type: 'Copyleft Contamination',
                    file: 'src/lib/helpers.js',
                    line: 12,
                    msg: 'GPL-licenced code found in proprietary repo'
                }
            ]
        }
    ];

    let scenarioIndex = 0;

    async function runScenario(idx) {
        const s = SCENARIOS[idx];
        cancelled = false;
        term.textContent = '';
        running = true;
        startBtn.style.display = 'none';
        resetBtn.style.display = 'none';

        await typeLineWithPrefix('$ ', s.cmd, 'tw-cmd');
        await sleep(400);

        appendLine('<span class="tw-ok">Scanner</span> <span class="tw-dim">v3.0.22</span>');
        await sleep(200);
        await typeLine('Scanning...', 'tw-dim');
        await sleep(300);

        const barId = 'pb-' + Date.now();
        appendRaw(
            `<div class="tw-progress"><span class="tw-dim">Analyzing files...</span><div class="tw-bar"><div class="tw-bar-fill" id="${barId}" style="width:0%"></div></div></div>`
        );
        for (let p = 0; p <= 100; p += 10) {
            if (cancelled) return;
            document.getElementById(barId).style.width = p + '%';
            await sleep(typeSpeed < 20 ? 30 : 120);
        }
        await sleep(200);

        appendLine(`<span class="tw-ok">Gate rules checked:</span> <span class="tw-dim">${s.files} files</span>`);
        appendLine(
            `<span class="tw-ok">Mock/sample files:</span> <span class="tw-dim">${Math.floor(s.files * 0.08)}</span>`
        );
        await sleep(300);

        appendLine(`<span class="tw-warn">Issues found: ${s.findings.length}</span>`);
        await sleep(200);

        for (const f of s.findings) {
            if (cancelled) return;
            const badge =
                f.sev === 'critical'
                    ? '<span class="tw-badge tw-red">CRITICAL</span>'
                    : f.sev === 'high'
                      ? '<span class="tw-badge tw-red">HIGH</span>'
                      : f.sev === 'medium'
                        ? '<span class="tw-badge tw-yel">MEDIUM</span>'
                        : '<span class="tw-badge tw-blu">LOW</span>';
            appendRaw(
                `<div class="tw-finding ${f.sev}">${badge} <span class="tw-warn">${f.type}</span> <span class="tw-dim">— ${f.file}:${f.line}</span><br><span class="tw-dim">${f.msg}</span></div>`
            );
            await sleep(typeSpeed < 20 ? 200 : 600);
        }

        const hasBlocking = s.findings.some(f => f.sev === 'high' || f.sev === 'critical');
        await sleep(300);
        if (hasBlocking) {
            appendLine('<span class="tw-err">Gate: FAIL</span> — blocking issues found');
            appendLine('<span class="tw-dim">Run `npx simplebeacon ai-plan` to generate remediation steps</span>');
        } else {
            appendLine('<span class="tw-ok">Gate: PASS</span>');
        }

        const score = Math.max(
            0,
            100 -
                s.findings.filter(f => f.sev === 'high' || f.sev === 'critical').length * 12 -
                s.findings.filter(f => f.sev === 'medium').length * 4
        );
        appendLine(`<span class="tw-dim">Quality Score: ${score}/100</span>`);

        appendRaw('<span class="tw-prompt">$ </span><span class="tw-cursor"></span>');

        running = false;
        resetBtn.style.display = 'inline-block';
    }

    async function showResultsInstant(idx) {
        cancelled = true;
        await sleep(50);
        const s = SCENARIOS[idx];
        term.textContent = '';

        appendLine('<span class="tw-prompt">$ </span><span class="tw-cmd">' + s.cmd + '</span>');
        appendLine('<span class="tw-ok">Scanner</span> <span class="tw-dim">v3.0.22</span>');
        appendLine('<span class="tw-dim">Scanning... Analyzing files... Done.</span>');
        appendLine(`<span class="tw-ok">Gate rules checked:</span> <span class="tw-dim">${s.files} files</span>`);
        appendLine(`<span class="tw-warn">Issues found: ${s.findings.length}</span>`);

        for (const f of s.findings) {
            const badge =
                f.sev === 'critical'
                    ? '<span class="tw-badge tw-red">CRITICAL</span>'
                    : f.sev === 'high'
                      ? '<span class="tw-badge tw-red">HIGH</span>'
                      : f.sev === 'medium'
                        ? '<span class="tw-badge tw-yel">MEDIUM</span>'
                        : '<span class="tw-badge tw-blu">LOW</span>';
            appendRaw(
                `<div class="tw-finding ${f.sev}">${badge} <span class="tw-warn">${f.type}</span> <span class="tw-dim">— ${f.file}:${f.line}</span><br><span class="tw-dim">${f.msg}</span></div>`
            );
        }

        const hasBlocking = s.findings.some(f => f.sev === 'high' || f.sev === 'critical');
        if (hasBlocking) {
            appendLine('<span class="tw-err">Gate: FAIL</span> — blocking issues found');
        } else {
            appendLine('<span class="tw-ok">Gate: PASS</span>');
        }
        const score = Math.max(
            0,
            100 -
                s.findings.filter(f => f.sev === 'high' || f.sev === 'critical').length * 12 -
                s.findings.filter(f => f.sev === 'medium').length * 4
        );
        appendLine(`<span class="tw-dim">Quality Score: ${score}/100</span>`);
        appendRaw('<span class="tw-prompt">$ </span><span class="tw-cursor"></span>');

        resetBtn.style.display = 'inline-block';
        startBtn.style.display = 'none';
    }

    startBtn.addEventListener('click', () => {
        scenarioIndex = (scenarioIndex + 1) % SCENARIOS.length;
        runScenario(scenarioIndex);
    });

    resetBtn.addEventListener('click', () => {
        scenarioIndex = (scenarioIndex + 1) % SCENARIOS.length;
        runScenario(scenarioIndex);
    });

    skipLink.addEventListener('click', e => {
        e.preventDefault();
        showResultsInstant(scenarioIndex);
    });

    document.querySelectorAll('.tw-speed-opt').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.tw-speed-opt').forEach(o => o.classList.remove('tw-active'));
            el.classList.add('tw-active');
            typeSpeed = parseInt(el.dataset.ms);
        });
    });

    // Auto-start first scenario on load
    runScenario(0);
})();
