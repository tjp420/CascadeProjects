# End-to-End License Flow Test Guide

This guide walks through testing the complete purchase → token → unlock flow to ensure the licensing system works correctly before going live.

## Prerequisites

- [ ] Stripe account configured with live or test mode products
- [ ] Billing API deployed and accessible
- [ ] Email service configured (Resend or SMTP)
- [ ] VSCode extension installed locally
- [ ] License secret configured in both backend and extension

## Test Environment Setup

### 1. Backend Configuration

Ensure your backend has these environment variables set:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...  # or sk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_...

# Product Price IDs
STRIPE_PRICE_ID_TEAMS_MONTHLY=price_...
STRIPE_PRICE_ID_EXECUTIVE_CLEARANCE=price_...
STRIPE_PRICE_ID_INSTANT_REPORT=price_...

# License Token Signing
SIMPLEBEACON_LICENSE_SECRET=<your-secure-secret>

# Email Service
RESEND_API_KEY=re_...
RESEND_FROM=onboarding@simplebeacon.com
```

### 2. Extension Configuration

Ensure the extension has the same license secret:

```json
{
  "simplebeacon.licenseSecret": "<your-secure-secret>",
  "simplebeacon.licenseToken": ""
}
```

## Test Flow

### Step 1: Install Extension

1. **Install from local source:**
   ```bash
   cd vscode-extension
   npm install
   npm run build
   code --install-extension simplebeacon-0.5.11.vsix
   ```

2. **Or install from marketplace (if published):**
   - Open VSCode
   - Go to Extensions panel
   - Search for "Simplebeacon"
   - Click Install

### Step 2: Verify Free Tier Works

1. Open a test project in VSCode
2. Open the Simplebeacon sidebar (Ctrl+Shift+P → "Simplebeacon: Show Sidebar")
3. Run a scan
4. Verify the scan completes and shows results
5. Check that tier shows as "free" in the status

### Step 3: Initiate Purchase

1. In the Simplebeacon sidebar, click "Upgrade to Pro"
2. Select a product (e.g., "Teams Monthly")
3. This should redirect to the Stripe checkout page

**Expected behavior:**
- Stripe checkout page opens in browser
- Product name and price are correct
- Payment form loads successfully

### Step 4: Complete Test Purchase

**For Stripe Test Mode:**
1. Use Stripe test card: `4242 4242 4242 4242`
2. Use any future expiry date (e.g., 12/34)
3. Use any 3-digit CVC (e.g., 123)
4. Use any ZIP code
5. Complete the payment

**For Stripe Live Mode:**
1. Use a real payment method
2. Complete the payment
3. **Note:** Use a small amount or refundable test first

### Step 5: Verify Webhook Received

1. Check your backend logs for webhook events
2. Look for `checkout.session.completed` event
3. Verify the event contains:
   - Customer email
   - Price ID
   - Payment status (paid)
   - Session ID

**Expected log output:**
```
Webhook received: checkout.session.completed
Customer email: test@example.com
Price ID: price_...
Payment status: paid
```

### Step 6: Verify License Token Generated

1. Check backend logs for token generation
2. Look for license token creation log
3. Verify the token is a valid JWT

**Expected log output:**
```
License token generated for test@example.com
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 7: Verify Email Sent

1. Check your email inbox (test@example.com)
2. Look for email with subject: "Payment Confirmed" or similar
3. Verify email contains:
   - License token
   - Product name
   - Next steps
   - Support contact

**Expected email content:**
```
Subject: Payment Confirmed - Simplebeacon Teams Monthly

Your license token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 8: Copy License Token

1. Copy the license token from the email
2. The token should be a long JWT string (starts with `eyJ`)

### Step 9: Activate License in Extension

1. Open VSCode settings (Ctrl+,)
2. Search for "simplebeacon"
3. Find "Simplebeacon: License Token"
4. Paste the license token
5. Save settings

### Step 10: Verify Pro Features Unlocked

1. Open the Simplebeacon sidebar
2. Check the tier status
3. Verify it shows "teams" or "pro" instead of "free"
4. Run a scan to confirm Pro features work

**Expected behavior:**
- Tier status shows "teams" or "pro"
- Pro features are accessible (full scan, advanced rules, etc.)
- No license validation errors

### Step 11: Test Subscription Management (if applicable)

For subscription products (Teams Monthly, Continuous Shield, etc.):

1. In the Simplebeacon sidebar, click "Manage Subscription"
2. This should redirect to the Stripe customer portal
3. Verify you can:
   - View subscription details
   - Update payment method
   - Cancel subscription
   - View invoice history

### Step 12: Test License Validation

1. Open VSCode developer console (Help → Toggle Developer Tools)
2. Check for license validation errors
3. Verify the token is being validated correctly

**Expected console output:**
```
License token validated successfully
Tier: teams
Expires: 2025-07-09T12:00:00Z
```

## Troubleshooting

### Webhook Not Received

**Problem:** No webhook events in backend logs

**Solutions:**
- Verify webhook endpoint URL is correct
- Check Stripe webhook delivery logs
- Ensure webhook secret matches
- Check firewall/network settings

### Email Not Received

**Problem:** No email with license token

**Solutions:**
- Check email service credentials
- Verify email address is correct
- Check spam folder
- Review email queue directory for failed attempts
- Test email service independently

### License Token Invalid

**Problem:** Extension shows "Invalid license token"

**Solutions:**
- Verify `SIMPLEBEACON_LICENSE_SECRET` matches between backend and extension
- Check token is not expired
- Ensure token is copied correctly (no extra spaces)
- Verify JWT structure (should have 3 parts separated by dots)

### Pro Features Not Unlocked

**Problem:** Tier still shows "free" after entering token

**Solutions:**
- Verify token is saved in VSCode settings
- Check extension logs for validation errors
- Ensure license secret is configured
- Restart VSCode after adding token

### Stripe Checkout Fails

**Problem:** Checkout page doesn't load or payment fails

**Solutions:**
- Verify Price ID is correct
- Check Stripe account is active
- Ensure product is active in Stripe Dashboard
- Check you're using correct mode (test vs live)

## Test Results Checklist

- [ ] Extension installed successfully
- [ ] Free tier scan works
- [ ] Stripe checkout page loads
- [ ] Payment completes successfully
- [ ] Webhook received by backend
- [ ] License token generated
- [ ] Email sent with token
- [ ] Token copied correctly
- [ ] License activated in extension
- [ ] Pro features unlocked
- [ ] Tier status shows correct level
- [ ] Subscription management works (if applicable)
- [ ] License validation succeeds
- [ ] No errors in extension logs

## Production Readiness

Before going live:

1. **Switch to Live Mode:**
   - Update Stripe API keys to live mode
   - Update Price IDs to live mode
   - Update webhook secret to live mode

2. **Final Test:**
   - Complete a real test purchase (small amount)
   - Verify the full flow works
   - Refund the test purchase if needed

3. **Monitor:**
   - Set up monitoring for webhook failures
   - Monitor email delivery rates
   - Track license validation success rates

## Next Steps

After successful test:
1. Complete the extension README update
2. Finalize the launch plan
3. Set up domain and hosting
4. Complete marketplace publisher registration
5. Launch the product
