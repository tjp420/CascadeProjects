# Touch 1 Email Send Script

## Subject Lines to Test (A/B)

- **Variant A:** August 2026 is closer than it looks — [Company] AI compliance
- **Variant B:** Quick question about [Company]'s AI governance posture
- **Variant C:** [FirstName], your board is going to ask this

---

## Email Body (Template)

```
Hi {{FirstName}},

CCOs in {{Industry}} are starting to ask a hard question: *How much AI-generated code is already in production that we don't know about?*

With the EU AI Act enforcement deadline in August 2026, boards are now demanding proof that every AI integration is documented, disclosed, and compliant — not just the ones the engineering team volunteered.

We run a 48-hour "AI Slop Audit" that maps four specific risk areas:
1. Undocumented AI-generated placeholders in production code
2. Exposed API keys and credential leaks
3. Shadow AI models and unapproved third-party integrations
4. Open-source licensing conflicts from copy-pasted AI code

Zero source code leaves the machine. You get a one-page Executive Risk Certificate with an A-F grade and estimated financial liability per finding.

Worth a 12-minute call to see what it surfaces?

Best,
Trevor
Founder, SimpleBeacon

P.S. — We just finished one for a Series B HR tech company. They found 47 AI-generated placeholder strings, 2 exposed OpenAI keys, and one unapproved Anthropic integration the CISO didn't know about. Cost to fix: $14,000. Cost if a regulator found it first: $350,000+.
```

---

## Sending Workflow

### Step 1: Find Emails

Use Apollo.io, ZoomInfo, or Hunter.io to find emails for prospects in `outreach-prospects.js`:

```bash
# Example using Hunter.io API (free: 25 searches/month)
curl "https://api.hunter.io/v2/domain-search?domain=meridiancapital.com&api_key=$HUNTER_API_KEY"
```

Populate the `email` field in `outreach-prospects.js` and `email-tracking.csv`.

### Step 2: Personalize

For each email, replace:

- `{{FirstName}}` with first name
- `{{Company}}` with company name
- `{{Industry}}` with industry

Use mail merge or a simple Node script:

```javascript
const prospects = require('./outreach-prospects.js');
const template = require('fs').readFileSync('./touch1-template.txt', 'utf8');

for (const p of prospects.filter(x => x.status === 'pending' && x.email)) {
    const body = template
        .replace(/{{FirstName}}/g, p.name.split(' ')[0])
        .replace(/{{Company}}/g, p.company)
        .replace(/{{Industry}}/g, p.industry);
    console.log(
        `To: ${p.email}\nSubject: August 2026 is closer than it looks — ${p.company} AI compliance\n\n${body}\n---\n`
    );
}
```

### Step 3: Send (Recommended Tools)

**Option A: Instantly.ai** (cold email platform)

- Upload CSV
- Connect your domain (simplebeacon.ai)
- Set daily send limit: 25 emails/day (avoids spam flags)
- Enable open tracking + reply tracking
- Set up 3-step sequence (Touch 1 → Touch 2 → Touch 3)

**Option B: HubSpot Sales** (if you already use HubSpot)

- Import CSV
- Create sequence with automated follow-ups
- Track opens/clicks/replies in CRM

**Option C: Manual (first 10 only)**

- Send 10 personalized emails manually
- Track responses in `email-tracking.csv`
- Use this feedback to refine the template before scaling

### Step 4: Track in CSV

After sending, update `email-tracking.csv`:

```csv
name,company,...,status,lastContact,touch1Date,touch2Date,touch3Date,repliedDate,...
Sarah Chen,Meridian Capital,...,touch1_sent,2026-06-10,2026-06-10,,,,,,
```

### Step 5: Follow-Up Cadence

| Day | Action                                            |
| --- | ------------------------------------------------- |
| 0   | Send Touch 1 + LinkedIn connection request        |
| 1   | View LinkedIn profile (triggers notification)     |
| 3   | If no reply → Send Touch 2 (reply in same thread) |
| 5   | Like a LinkedIn post from prospect                |
| 7   | If still no reply → Send Touch 3 (final email)    |
| 14  | Add to nurture list (monthly compliance digest)   |

---

## Touch 2 Template (3 days later, if no reply)

```
Hi {{FirstName}},

Quick follow-up on the AI Slop Audit.

Most compliance teams we talk to assume their codebase is "clean enough." The problem is that AI-generated slop doesn't look like a bug — it looks like a comment, a placeholder URL, or a hardcoded metric that nobody questioned.

Here's what a real audit surfaced last month for a fintech client:

| Finding | Count | Est. Liability |
|---------|-------|----------------|
| Hardcoded placeholder diagnostics | 23 | $150,000 |
| Exposed staging API keys | 4 | $250,000 |
| Unapproved Claude integration | 1 | $350,000 |
| Copy-pasted GPL code block | 2 | $500,000 |
| Total estimated exposure | | $1.25M |

The fix took 3 days. The certificate bought the CCO board credibility.

If you're curious where {{Company}} sits, I can run the audit this week. No commitment, no code leaves your machine, and you keep the report.

Let me know.

Trevor
```

---

## Touch 3 Template (7 days later, if still no reply)

```
Hi {{FirstName}},

Last outreach — I promise.

One question: Does your current vendor security review process catch AI-generated code that ships to production?

Most DLP and SAST tools don't. They look for secrets and vulnerabilities, not for "Lorem Ipsum" placeholders that an AI assistant quietly inserted into a config file, or a hallucinated npm package that doesn't exist.

SimpleBeacon is a deterministic scanner built specifically for AI compliance. It runs offline, produces a board-ready risk certificate, and costs less than one hour of outside counsel.

If now isn't the right time, no problem. If it is, reply "audit" and I'll send you the self-service link.

Either way, good luck with the August deadline.

Trevor
Founder, SimpleBeacon
```

---

## LinkedIn Connection Note (150 chars)

```
Hi {{FirstName}}, I help CCOs find AI-generated slop and shadow models in production code before regulators do. Worth connecting?
```

---

## Success Metrics (Track Weekly)

| Metric              | Target   | How to Track                                    |
| ------------------- | -------- | ----------------------------------------------- |
| Touch 1 emails sent | 50/week  | Count rows with touch1Date in current week      |
| Open rate           | >40%     | Email platform analytics                        |
| Reply rate          | >5%      | Email platform + manual tagging                 |
| Meetings booked     | 2–3/week | Calendar / Calendly                             |
| Audit requests      | 10/month | `/api/test-checkout` hits with "audit" referral |
| Paid conversions    | 3/month  | Stripe dashboard                                |

---

## Anti-Spam Checklist

- [ ] Domain warmed up (send 5–10 emails/day for 2 weeks before scaling)
- [ ] DKIM/SPF/DMARC configured for simplebeacon.ai
- [ ] Unsubscribe link in every email (required by CAN-SPAM)
- [ ] No more than 25 emails/day from one address
- [ ] Personalize every email (at minimum: first name + company)
- [ ] Never use "Dear Sir/Madam" or generic salutations
- [ ] Keep subject lines under 60 characters
- [ ] Test with Mail-Tester.com before first batch
