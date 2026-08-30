# SimpleBeacon Launch Announcement Copy

> **Verified for accuracy against production pricing and CLI commands.**
> Three claims from the original draft were corrected:
> - "$5/mo for individuals" → removed (no such tier exists; Free tier is $0, Developer is $49/mo)
> - "WebGPU options" in HN tips → removed (WebGPU is used for attestation fingerprinting only, not scan compute)
> - "sub-millisecond" → "milliseconds" (verifiable; sub-millisecond is not claimed anywhere in the codebase)

---

## Primary Launch Post (X / Twitter / LinkedIn)

If an AI code scanner tells you it has zero server overhead, infinite scaling, and absolute data privacy, you should assume it's lying.

That's why we built SimpleBeacon differently. We didn't build another cloud SaaS that hoards your enterprise source code. We built a local-first, self-contained static analysis engine.

Traditional static analysis tools charge a massive premium because they pay astronomical cloud compute bills to process your files. We passed 100% of that compute to your local machine.

SimpleBeacon runs all 48 structural analyzers and 25 scan engines directly on your local CPU. Your code never leaves your device, and our inference cost is exactly $0.

Don't take our word for it. We want you to test if we're lying — The Airplane Test:

1. Install the CLI: `npm install -g simplebeacon`
2. Turn off your Wi-Fi completely (Airplane Mode)
3. Run a full scan: `simplebeacon scan --path ./your-project --offline`

It will run instantly, trace cross-module dependencies, map your AI agent blast radius, and output code-slop summaries — all while completely disconnected from the internet.

Why it matters:
- Unmatched speed: local processing with zero network latency
- Total privacy: compliant with enterprise standards because we are blind to your source code
- Unbeatable pricing: Free tier costs nothing, Developer is $49/mo, Team Pro is $149/mo — because we have no server bills to pass on

Stop paying the "SaaS Tax" for cloud servers that put your intellectual property at risk.

Try it yourself (and try to break it): https://simplebeacon.ai
Audit our local architecture: https://simplebeacon.ai/security-whitepaper

---

## Hacker News — Show HN

**Title:** Show HN: SimpleBeacon – A local-first, zero-upload code scanner that works offline

**Body:**

Hi HN. We built a static analysis tool that runs entirely on your local machine — no source code ever leaves your device.

The core engine is 48 analyzers and 25 scan engines packaged as a Node.js CLI and a browser-based Web Worker sandbox. We deliberately avoided compiling it into an obfuscated binary. The entire analyzer rule set is readable JavaScript that you can inspect in `node_modules/simplebeacon/src/`.

The "Airplane Test" is our core trust proposition:

1. `npm install -g simplebeacon`
2. Enable Airplane Mode
3. `simplebeacon scan --path ./your-project --offline`

The scan completes fully with zero network dependency. License tokens are validated locally via HMAC-SHA256, so even paid features work disconnected.

Architecture decisions we'd like feedback on:
- Browser sandbox uses the File System Access API + Web Workers for in-memory scanning. The tab's memory is wiped on close — no IndexedDB persistence of file contents.
- CLI uses `--air-gapped` mode for enterprise deployments with a cache export/import pipeline for USB transfer to disconnected networks.
- CSP headers restrict `connect-src` to only our domain, Stripe, and Cloudflare Insights. No wildcard origins.
- `_routes.json` on Cloudflare Pages explicitly isolates which paths hit serverless functions vs. static CDN.

We wrote up the full security architecture here: https://simplebeacon.ai/security-whitepaper

Pricing: Free tier (browser sandbox, no account), Developer $49/mo, Team Pro $149/mo. The reason it's cheap is that we have approximately zero cloud compute costs — you provide the CPU.

Happy to answer technical questions about the analyzer engine, the offline license validation, or the browser sandbox memory isolation.

---

## Reddit — r/programming, r/node, r/webdev

**Title:** I built a code scanner that works with Wi-Fi off — no source code ever leaves your machine

**Body:**

Most static analysis tools are SaaS products that require you to upload your source code to their servers. I wanted to see if I could build one that runs entirely locally — in the browser via Web Workers, or as a Node.js CLI — with zero source code upload.

It's called SimpleBeacon. The core is 48 analyzer modules that detect AI-generated code slop, exposed credentials, compliance gaps, and structural debt. All analysis happens in-memory on your machine.

The technical bits I'm most interested in feedback on:

1. **Browser sandbox**: Uses the File System Access API to read files, processes everything in a Web Worker, and renders results in the DOM. No `fetch()`, `XMLHttpRequest`, or `WebSocket` calls carry file contents. The browser's Same-Origin Policy and strict CSP headers provide defense-in-depth.

2. **Offline license validation**: Paid features use JWT license tokens validated locally via HMAC-SHA256. No license server contact required during a scan. The `--air-gapped` flag skips even that, for enterprise disconnected deployments.

3. **Cache API for offline browser scans**: The dashboard's core engines are persisted via the browser's Cache API, so you can run scans even after the page loads with no network. The "Airplane Test" — load the page, disconnect Wi-Fi, run a scan — works.

4. **Open-source engine**: The CLI is distributed as readable JavaScript. You can `grep -r "fetch\|http\|socket" src/` and verify there are no hidden network calls in the scan pipeline.

Try the Airplane Test yourself:

```bash
npm install -g simplebeacon
# Enable Airplane Mode
simplebeacon scan --path ./your-project --offline
```

Or try the browser sandbox (no install): https://simplebeacon.ai/dashboard

Full security whitepaper with the verification methodology: https://simplebeacon.ai/security-whitepaper

Free tier works without an account. Developer tier is $49/mo if you want CI gate integration and unlimited scans.

What would you want to see before trusting a local-first scanner? What am I missing?
