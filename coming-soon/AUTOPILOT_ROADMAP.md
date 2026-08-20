# SimpleBeacon Autopilot Roadmap

## Goal

Reduce human intervention to near-zero. A customer buys a plan, connects their repo, and receives certificates automatically without returning to the dashboard.

---

## Current Manual Steps (Today)

1. Select modules on pricing page → click "Build Plan"
2. Copy token from display (or wait for email)
3. Go to certificate-upload.html
4. Paste token into input
5. Upload source ZIP or click "Select Folder"
6. Wait for scan to complete
7. Click "Generate Certificate"
8. Download ZIP manually
9. (EU AI Act Sprint only) Wait 24h for analyst email

**Touchpoints:** 7 manual clicks, 3 page navigations, 1 email wait

---

## Phase 1: One-Click Certificate from Scan (Week 1)

### 1.1 Auto-Generate Certificate on Scan Complete

**File:** `js/dashboard/scanner-engine.js`

After `renderPreview(reportData)` at line ~2176, add:

```javascript
// Autopilot: if token is valid and user has not disabled auto-cert, generate immediately
if (hasValidToken() && localStorage.getItem('sb_autoCert') !== 'false') {
    setTimeout(() => {
        if (typeof doGenerateCertificate === 'function') {
            doGenerateCertificate(document.getElementById('submitBtn'));
        }
    }, 800); // Brief delay so user sees preview first
}
```

**File:** `js/dashboard/main.js`

Add checkbox near submit button:

```html
<label style="font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;margin-top:8px;">
    <input type="checkbox" id="autoCertCheckbox" checked /> Auto-generate certificate when scan completes
</label>
```

Persist preference:

```javascript
document.getElementById('autoCertCheckbox')?.addEventListener('change', e => {
    localStorage.setItem('sb_autoCert', e.target.checked);
});
```

**Impact:** Removes step 7 (manual "Generate Certificate" click).

---

## Phase 2: GitHub / GitLab Auto-Scan (Week 2-3)

### 2.1 New Endpoint: Webhook Receiver

**File:** `routes/webhook.cjs` (new, ~80 lines)

```javascript
const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

router.post('/api/webhook/github', async (req, res) => {
    const event = req.headers['x-github-event'];
    const payload = req.body;
    if (event !== 'push') return res.status(200).send('Ignored');

    const repo = payload.repository?.full_name;
    const branch = payload.ref?.replace('refs/heads/', '');
    const token = req.query.licenseToken;

    if (!token || !repo) return res.status(400).json({ error: 'Missing token or repo' });

    // Queue scan job (see Phase 5)
    await enqueueScanJob({ repo, branch, token, source: 'github' });

    res.json({ queued: true, jobId });
});
```

### 2.2 GitHub App / OAuth Integration

**New file:** `js/github-connect.js`

- OAuth flow to authorize repo access
- Store `installation_id` + `repo_list` + `license_token` in backend DB
- Display connected repos in dashboard

**File:** `certificate-upload.html`

Add section:

```html
<div id="githubConnectSection" style="margin-top:16px;">
    <button id="connectGitHubBtn">Connect GitHub Repository</button>
    <div id="connectedRepos" style="display:none;">
        <p>Auto-scan on every push to:</p>
        <ul id="repoList"></ul>
        <label><input type="checkbox" id="autoScanOnPush" checked /> Auto-scan on push</label>
    </div>
</div>
```

**Impact:** Removes steps 3-6 entirely for GitHub users. Push code → scan → certificate emailed.

---

## Phase 3: Auto-Email Certificate (Week 2)

### 3.1 Server-Side Certificate Email

**File:** `routes/checkout.cjs` — extend `/api/test-checkout`

Store email + token mapping in a JSON file or SQLite:

```javascript
const customerDb = path.join(__dirname, '..', 'data', 'customers.json');
function saveCustomer({ email, token, tier, repo }) {
    const db = JSON.parse(fs.readFileSync(customerDb, 'utf8') || '[]');
    db.push({ email, token, tier, repo, createdAt: Date.now() });
    fs.writeFileSync(customerDb, JSON.stringify(db, null, 2));
}
```

### 3.2 Email Certificate After Scan

**New endpoint:** `POST /api/scan-complete`

Called by browser after scan (or by worker after server-side scan):

```javascript
router.post('/api/scan-complete', async (req, res) => {
    const { token, reportHash, grade } = req.body;
    const customer = findCustomerByToken(token);
    if (!customer) return res.status(404).json({ error: 'Token not found' });

    const certUrl = `${PUBLIC_URL}/certificate-upload.html?token=${encodeURIComponent(token)}`;
    await sendEmail({
        to: customer.email,
        subject: `SimpleBeacon Certificate — Grade ${grade}`,
        text: `Your scan is complete. Grade: ${grade}. View certificate: ${certUrl}`,
        html: `<p>Your <strong>SimpleBeacon</strong> scan completed.</p><p>Grade: <strong>${grade}</strong></p><a href="${certUrl}">Download Certificate</a>`
    });
    res.json({ emailed: true });
});
```

**Impact:** Removes step 8 (user must remember to download). Certificate arrives in inbox.

---

## Phase 4: CI/CD Plugin (Week 3-4)

### 4.1 GitHub Action

**New repo/file:** `.github/actions/simplebeacon-scan/action.yml`

```yaml
name: 'SimpleBeacon Scan'
inputs:
    token:
        description: 'SimpleBeacon license token'
        required: true
runs:
    using: 'composite'
    steps:
        - run: npx simplebeacon-cli scan --token ${{ inputs.token }} --format json --output report.json
        - run: npx simplebeacon-cli certify --token ${{ inputs.token }} --report report.json
        - run: |
              curl -X POST https://simplebeacon.onrender.com/api/scan-complete \
                -H "Content-Type: application/json" \
                -d "{\"token\":\"${{ inputs.token }}\",\"grade\":\"$(cat grade.txt)\"}"
```

### 4.2 NPM CLI Package

**New directory:** `packages/simplebeacon-cli/`

```javascript
#!/usr/bin/env node
const { runScan } = require('./src/scan');
const argv = require('minimist')(process.argv.slice(2));

async function main() {
    const report = await runScan(process.cwd(), { token: argv.token, gate: true });
    fs.writeFileSync(argv.output || 'simplebeacon-report.json', JSON.stringify(report, null, 2));
    if (argv.certify) {
        const { generateCertificate } = require('./src/certify');
        await generateCertificate(report, argv.token);
    }
}
main();
```

**Impact:** Enables "push to main → GitHub Action runs → certificate auto-emailed" with zero dashboard visits.

---

## Phase 5: Background Scan Worker (Week 4)

### 5.1 Scan Job Queue

**New file:** `lib/scan-queue.js`

```javascript
const queue = [];
let isProcessing = false;

async function enqueueScanJob(job) {
    queue.push(job);
    if (!isProcessing) processQueue();
}

async function processQueue() {
    isProcessing = true;
    while (queue.length > 0) {
        const job = queue.shift();
        await runServerSideScan(job); // Clone repo, run headless scan
    }
    isProcessing = false;
}
```

### 5.2 Server-Side Scan (Optional)

For customers who don't want browser scanning, provide server-side option:

- Clone repo from GitHub webhook
- Run `simplebeacon-cli` in isolated process
- Generate certificate server-side
- Email result

**Note:** This changes the "zero upload" promise. Make it opt-in:

```html
<label
    ><input type="checkbox" id="serverSideScan" /> Run scan on SimpleBeacon servers (faster, no browser needed)</label
>
```

---

## Phase 6: Analyst Autopilot (Week 3-4)

### 6.1 Auto-Ticket Creation (EU AI Act Sprint)

**File:** `routes/checkout.cjs`

On `eu_ai_act_sprint` purchase:

```javascript
const ticketId = 'EUAIS-' + Date.now().toString(36).toUpperCase();
const ticket = {
    ticketId,
    email,
    projectName,
    status: 'AWAITING_SCAN',
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    analystNotes: []
};
saveTicket(ticket);

// Auto-email analyst + customer
try {
    await sendEmail({ to: ANALYST_EMAIL, subject: `New EU AI Act Sprint: ${ticketId}`, text: JSON.stringify(ticket) });
} catch (e) {}
try {
    await sendEmail({
        to: email,
        subject: `EU AI Act Sprint Started — ${ticketId}`,
        text: `Your 30-day analyst support begins now. Ticket: ${ticketId}`
    });
} catch (e) {}
```

### 6.2 Auto-Analyst Dashboard

**New file:** `admin/analyst-dashboard.html`

- Poll `/api/tickets` every 30s
- Show: ticket ID, customer, days remaining, scan status, actions
- Pre-fill template responses:
    - "Scan complete, no high-risk indicators found."
    - "Article 14 oversight docs missing — please see attached checklist."
    - "Risk classification confirmed: limited risk. Certificate finalized."

### 6.3 Auto-Responder for Common Cases

**File:** `routes/tickets.cjs`

```javascript
router.post('/api/tickets/:id/respond', async (req, res) => {
    const ticket = getTicket(req.params.id);
    const report = ticket.scanReport;

    // Auto-response rules
    if (report.euAiActSummary?.highRiskIndicators === 0) {
        await sendEmail({
            to: ticket.email,
            subject: `EU AI Act Sprint — No High-Risk Findings`,
            text: `Good news: our initial scan found no high-risk AI indicators. Your compliance posture is favorable. Review the attached certificate for details.`
        });
        ticket.status = 'AUTO_CLOSED';
    }
    // Else: flag for human analyst
});
```

**Impact:** Analyst only touches tickets that have actual high-risk findings. Low-risk tickets auto-close.

---

## Phase 7: Recurring / Scheduled Scans (Week 5)

### 7.1 Cron-Like Scheduling

**File:** `lib/scheduler.js`

```javascript
const cron = require('node-cron'); // or setInterval

// Daily check for tokens expiring in 7 days
setInterval(
    async () => {
        const customers = loadCustomers();
        for (const c of customers) {
            const daysLeft = (c.expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
            if (daysLeft < 7 && daysLeft > 6) {
                await sendEmail({
                    to: c.email,
                    subject: 'Your SimpleBeacon token expires in 7 days',
                    text: `Re-scan before ${new Date(c.expiresAt).toLocaleDateString()} to maintain your certificate.`
                });
            }
        }
    },
    24 * 60 * 60 * 1000
);
```

### 7.2 Weekly Auto-Scan for Connected Repos

```javascript
// Every Monday 9am
setInterval(
    async () => {
        const now = new Date();
        if (now.getDay() === 1 && now.getHours() === 9) {
            const connected = loadCustomers().filter(c => c.githubRepo);
            for (const c of connected) {
                await enqueueScanJob({ repo: c.githubRepo, token: c.token, source: 'scheduled' });
            }
        }
    },
    60 * 60 * 1000
); // Check every hour
```

---

## Quick Wins (Do These First — 1 Day)

| #   | Change                                   | File                                   | Impact                          |
| --- | ---------------------------------------- | -------------------------------------- | ------------------------------- |
| 1   | Auto-generate certificate after scan     | `scanner-engine.js`                    | -1 manual click                 |
| 2   | Persist token in URL on certificate page | `certificate-upload.html`              | Users don't re-paste token      |
| 3   | Auto-email certificate on generation     | `certificate-module.js` + new endpoint | No manual download              |
| 4   | Add "Copy Token" button with one-click   | `pricing.html`                         | Easier token handoff            |
| 5   | Pre-fill token from URL param            | `certificate-upload.html`              | Zero paste if coming from email |

---

## Files to Create

| File                                 | Purpose                              |
| ------------------------------------ | ------------------------------------ |
| `routes/webhook.cjs`                 | GitHub/GitLab push webhook receiver  |
| `routes/tickets.cjs`                 | Analyst ticket CRUD + auto-responder |
| `lib/scan-queue.js`                  | Background job queue                 |
| `lib/scheduler.js`                   | Cron-like recurring scans            |
| `admin/analyst-dashboard.html`       | Analyst UI                           |
| `js/github-connect.js`               | GitHub OAuth flow                    |
| `packages/simplebeacon-cli/`         | NPM CLI for CI/CD                    |
| `.github/actions/simplebeacon-scan/` | GitHub Action                        |

---

## Success Metrics

| Metric                        | Before | After Autopilot          |
| ----------------------------- | ------ | ------------------------ |
| Manual clicks per certificate | 7      | 1 (buy plan)             |
| Time from push to certificate | 15 min | 3 min                    |
| Analyst tickets needing human | 100%   | ~20% (high-risk only)    |
| Customer re-engagement rate   | Low    | High (weekly auto-scans) |

---

## Notes

- **No new dependencies for Phase 1.** Auto-cert is a `setTimeout` in existing code.
- **Phase 2 requires a backend database.** Use a JSON file first, SQLite later.
- **"Zero upload" is a core value.** Server-side scanning must be opt-in.
- **Analyst autopilot only works if scanner gaps are fixed first** (see `EU_AI_ACT_SPRINT_IMPLEMENTATION_PLAN.md`).
