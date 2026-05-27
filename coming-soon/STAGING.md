# Staging environment (test before live billing)

Use staging to run the full paywall → Stripe → audit flow **without charging real cards** or relying on `audit@simplebeacon.ai` routing.

## Payments toggle

Stripe is **off** by default while you test. In `site-config.js`:

```javascript
var PAYMENTS_ENABLED = false; // set true when ready to bill
```

When `false`, book buttons scroll to the **booking form** (no Stripe). Submitting the form sends email via Resend when configured.

## Send real email from the booking form

The paywall includes a **booking form** that POSTs to `/api/audit-booking` and sends to your inbox via [Resend](https://resend.com).

### Local (localhost:54355)

1. Sign up at https://resend.com and create an API key.
2. Add to `ai-platform/.env.v1-internal`:

```env
RESEND_API_KEY=re_your_key_here
AUDIT_NOTIFY_TO=trevor_punt@live.com
AUDIT_NOTIFY_FROM=SimpleBeacon <onboarding@resend.dev>
```

3. Restart: `npm run staging:paywall`
4. Fill the booking form → **Send booking request** → check `trevor_punt@live.com`.

Until Resend is configured, submissions are saved to `ai-platform/data/audit-bookings.json` and the form shows an error.

### Production (Cloudflare Pages)

1. Deploy `coming-soon/` including the `functions/` folder.
2. Run:

```powershell
cd coming-soon
.\scripts\setup-audit-booking-notify.ps1 -ProjectName "your-pages-project" -ResendApiKey "re_xxx" -NotifyTo "trevor_punt@live.com"
```

3. Verify `simplebeacon.ai` in Resend, then set `AUDIT_NOTIFY_FROM=SimpleBeacon <noreply@simplebeacon.ai>`.

## How environments split

| Host | Stripe | Booking email | Banner |
|------|--------|---------------|--------|
| `localhost:54355` | **Test** link | `trevor_punt@live.com` | Yellow staging bar |
| `*.pages.dev` (Cloudflare preview) | **Test** | `trevor_punt@live.com` | Yellow staging bar |
| `staging.simplebeacon.ai` (optional) | **Test** | `trevor_punt@live.com` | Yellow staging bar |
| `simplebeacon.ai` / `www` | **Live** link | `audit@simplebeacon.ai` | No banner |

Configured in `site-config.js` (auto-detect by hostname).

## Local staging (fastest)

```powershell
cd ai-platform
npm run staging:paywall
```

Open:

- Paywall + diagnostic: http://localhost:54355/
- Prep tool: http://localhost:54355/downloads/diagnostic-prep.html
- Sample report: http://localhost:54355/sample-report.html
- Vault dashboard: http://localhost:54355/private-dashboard-vault?password=YOUR_VAULT_PASSWORD

## Test Stripe checkout

1. Run diagnostic → click **Test Book Audit**
2. Stripe **test** checkout opens (`buy.stripe.com/test_...`)
3. Card: `4242 4242 4242 4242` · any future expiry · any CVC
4. No real money moves

## Test the audit delivery loop (your PC)

```powershell
mkdir C:\Users\Trevor\AuditSandbox\staging-client -Force
# copy a repo or sample files into staging-client
cd ai-platform
.\tools\run-client-audit.ps1 -ClientPath "C:\Users\Trevor\AuditSandbox\staging-client" -CompanyName "Staging Test Agency" -Assessor "Trevor"
```

Email the PDF to yourself — simulates client delivery.

## Cloudflare staging preview

1. Deploy `coming-soon/` to Cloudflare Pages
2. Use the **preview URL** (`*.pages.dev`) — automatically test Stripe + staging banner
3. Do **not** point `simplebeacon.ai` at the new paywall until:
   - `audit@simplebeacon.ai` forwarding works
   - You completed one full staging test payment + PDF delivery

## Optional: staging subdomain

Create `staging.simplebeacon.ai` → same Pages project or a second project uploading `coming-soon/`. It stays in test mode automatically.

## Go live checklist

- [ ] Cloudflare Email Routing: `audit@simplebeacon.ai` → your inbox verified
- [ ] One full test on localhost (diagnostic → test Stripe → run-client-audit → PDF)
- [ ] Deploy `coming-soon/` to production `simplebeacon.ai`
- [ ] One live $499 test payment (or small live test) on production domain only
