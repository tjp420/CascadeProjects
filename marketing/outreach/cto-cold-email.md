# VP of Engineering Outreach Template: AI-Generated Code Debt and Zero-Upload Audit

**Subject:** [Company] + AI-generated code debt — quick 5-minute audit

**Alternative Subject:** Shadow AI hitting [Company]'s repos?

---

Hi [FirstName],

I keep talking to VPs of Engineering who are suddenly dealing with AI-generated code hitting their repos before review. The common thread: hardcoded API keys, placeholder KPIs, hallucinated npm dependencies, and unfinished AI placeholders slipping past normal linters.

I built **SimpleBeacon** to run a 100% offline scan on the developer's machine — no source code ever leaves your infrastructure. It takes about 5 minutes to surface the kind of debris that becomes an investor or auditor problem later.

A few things it catches out of the box:

1. **Credential leaks** — hardcoded API keys, tokens, and env values that made it past review.
2. **Hallucinated dependencies** — npm/pip packages that LLMs invented and no one verified.
3. **AI slop artifacts** — raw markdown fences, TODO stubs, and fake KPIs in production files.
4. **EU AI Act / SOC 2 gaps** — mappings that feed directly into a board-ready Executive Risk Certificate.

Worth a 10-minute demo this week? I can run it on a repo you point me to and show you exactly what the certificate output looks like.

Best,
[Your_Name]
Founder, SimpleBeacon | simplebeacon.ai
