Resend email setup and production checklist
=========================================

Overview
--------

This document describes how to provision `RESEND_API_KEY` and related environment variables for production, how to test outbound delivery, and how to rotate Resend API keys safely with zero-downtime.

Production env var snippets
---------------------------

Render (dashboard)
-------------------

- Render dashboard → Service → Environment → Add variables:
  - `RESEND_API_KEY` = `re_...`
  - `RESEND_FROM` = `certificates@simplebeacon.ai`
  - `RESEND_REPLY_TO` = `support@simplebeacon.ai` (optional)
- CLI automation example:

```bash
render services env create --service-id <SERVICE_ID> --key RESEND_API_KEY --value re_... --secure
render services env create --service-id <SERVICE_ID> --key RESEND_FROM --value certificates@simplebeacon.ai --secure
render services redeploy <SERVICE_ID>
```

Vercel (dashboard / CLI)
------------------------

- Vercel → Project → Settings → Environment Variables → Add `RESEND_API_KEY` and `RESEND_FROM` for `Production`.
- CLI example:

```bash
vercel env add RESEND_API_KEY production
vercel env add RESEND_FROM production
```

Docker / docker-compose
------------------------

- Use host `.env.production` (keep it outside git):

```
RESEND_API_KEY=re_...
RESEND_FROM=certificates@simplebeacon.ai
```

docker-compose snippet:

```yaml
services:
  api:
    image: your-image:latest
    environment:
      - RESEND_API_KEY
      - RESEND_FROM
```

GitHub Actions
--------------

- Add secrets in `Settings -> Secrets -> Actions`: `RESEND_API_KEY`, `RESEND_FROM`.
- Example verification step (requires Node 18+ on runner):

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Deploy
    run: ./scripts/deploy.sh
    env:
      RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
      RESEND_FROM: ${{ secrets.RESEND_FROM }}
  - name: Verify Resend email
    run: |
      node ai-platform/tools/send-test-resend-email.cjs
    env:
      RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
      RESEND_FROM: ${{ secrets.RESEND_FROM }}
      RESEND_TO: ${{ secrets.RESEND_TEST_TO }}
```

Testing the live send
---------------------

Use the included helper to send a signed test message to a recipient:

```bash
cd ai-platform
RESEND_API_KEY=re_xxx RESEND_FROM=certificates@simplebeacon.ai RESEND_TO=you@example.com node tools/send-test-resend-email.cjs
```

If the API key and `RESEND_FROM` are correct, the script will print the Resend API response JSON including the message id.

Resend API key rotation checklist
---------------------------------

1. In Resend dashboard generate a new API key (`re_...`) and record it securely.
2. Add the new key to your host secrets as `RESEND_API_KEY_NEW` (or similar) without removing the old key.
3. Update the email sending code (temporary) to attempt sending with `RESEND_API_KEY` then fallback to `RESEND_API_KEY_NEW` on auth failures. Example pattern:

```js
async function sendWithResend(payload) {
  const keys = [
    process.env.RESEND_API_KEY,
    process.env.RESEND_API_KEY_NEW,
  ].filter(Boolean);
  for (const k of keys) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        headers: { Authorization: `Bearer ${k}` },
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
      // if 401 or 403 try next key
      if (res.status === 401 || res.status === 403) continue;
      throw new Error(`Resend error ${res.status}`);
    } catch (err) {
      // log and try next
    }
  }
  throw new Error("All Resend API keys failed");
}
```

4. Deploy the fallback-capable code while both keys exist in secrets.
5. Use `ai-platform/tools/send-test-resend-email.cjs` to verify sending works with the new key present.
6. Replace `RESEND_API_KEY` with the new key in your host secret store, remove `RESEND_API_KEY_NEW`, and deploy the single-key code.
7. Update runbooks with rotation timestamp and operator.

Security reminders
------------------

- Never commit `RESEND_API_KEY` to source control. Use host-managed secrets.
- Limit access to secrets to deploy pipelines and ops personnel.
- Monitor bounce and suppression reports in Resend dashboard.
