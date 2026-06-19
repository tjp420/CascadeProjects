# Stripe Configuration Guide

This guide explains how to configure Stripe for live mode to accept payments for Simplebeacon products.

## Required Stripe Products

You need to create the following products in your Stripe Dashboard:

### 1. Teams Monthly Subscription
- **Product Name:** Teams Monthly
- **Price ID:** `STRIPE_PRICE_ID_TEAMS_MONTHLY`
- **Price:** $99/month (adjust as needed)
- **Type:** Recurring subscription
- **Interval:** Month

### 2. Teams Annual Subscription
- **Product Name:** Teams Annual
- **Price ID:** `STRIPE_PRICE_ID_TEAMS_ANNUAL`
- **Price:** $999/year (adjust as needed)
- **Type:** Recurring subscription
- **Interval:** Year

### 3. Executive Clearance (One-time)
- **Product Name:** Executive Risk Certificate
- **Price ID:** `STRIPE_PRICE_ID_EXECUTIVE_CLEARANCE`
- **Price:** $499.00
- **Type:** One-time payment

### 4. Instant Report (One-time)
- **Product Name:** Website Security Report
- **Price ID:** `STRIPE_PRICE_ID_INSTANT_REPORT`
- **Price:** $19.00
- **Type:** One-time payment

### 5. EU AI Act Sprint (One-time)
- **Product Name:** EU AI Act Sprint
- **Price ID:** `STRIPE_PRICE_ID_EU_AI_ACT_SPRINT`
- **Price:** $2,499.00
- **Type:** One-time payment

### 6. Continuous Shield (Subscription)
- **Product Name:** Continuous Shield
- **Price ID:** `STRIPE_PRICE_ID_CONTINUOUS_SHIELD`
- **Price:** $1,499.00/month
- **Type:** Recurring subscription
- **Interval:** Month

### 7. Runtime Shield (Subscription)
- **Product Name:** Runtime Shield
- **Price ID:** `STRIPE_PRICE_ID_RUNTIME_SHIELD`
- **Price:** $2,999.00/month
- **Type:** Recurring subscription
- **Interval:** Month

## Setup Steps

### 1. Create Stripe Account (if not already done)
- Go to https://dashboard.stripe.com/register
- Complete the registration process
- Verify your email and business information

### 2. Switch to Live Mode
- In the Stripe Dashboard, toggle from "Test mode" to "Live mode"
- Complete the onboarding requirements (bank account, business details, etc.)

### 3. Create Products and Prices

For each product listed above:

1. Go to **Products** → **Add product**
2. Fill in the product details:
   - Name: (as listed above)
   - Description: (appropriate description)
3. Add pricing:
   - For subscriptions: Set recurring billing
   - For one-time: Set one-time payment
4. Save the product
5. Copy the **Price ID** (starts with `price_`)

### 4. Configure Webhooks

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to your deployed server:
   ```
   https://your-domain.com/api/billing/webhook
   ```
4. Select the following events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Webhook Secret** (starts with `whsec_`)

### 5. Get API Keys

1. Go to **Developers** → **API keys**
2. Copy the **Secret key** (starts with `sk_live_`)
3. Copy the **Publishable key** (starts with `pk_live_`)

### 6. Update Environment Variables

Add the following to your production environment (`.env` or deployment platform):

```bash
# Stripe Live Mode
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Product Price IDs
STRIPE_PRICE_ID_TEAMS_MONTHLY=price_...
STRIPE_PRICE_ID_TEAMS_ANNUAL=price_...
STRIPE_PRICE_ID_EXECUTIVE_CLEARANCE=price_...
STRIPE_PRICE_ID_INSTANT_REPORT=price_...
STRIPE_PRICE_ID_EU_AI_ACT_SPRINT=price_...
STRIPE_PRICE_ID_CONTINUOUS_SHIELD=price_...
STRIPE_PRICE_ID_RUNTIME_SHIELD=price_...

# License Token Signing (generate a secure random string)
SIMPLEBEACON_LICENSE_SECRET=<generate-secure-random-string>
```

### 7. Generate License Secret

Generate a secure random string for the license token signing:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

### 8. Configure Email Service

The billing system sends confirmation emails with license tokens. Configure one of:

**Option A: Resend (Recommended)**
```bash
RESEND_API_KEY=re_...
RESEND_FROM=onboarding@simplebeacon.com
```

**Option B: SMTP**
```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_...
SMTP_FROM=onboarding@simplebeacon.com
SMTP_SECURE=true
```

### 9. Test the Flow

Before going live:

1. Switch back to **Test mode** in Stripe
2. Use test Price IDs (starting with `price_test_`)
3. Complete a test purchase using Stripe test cards
4. Verify the webhook is received
5. Check that the email is sent with the license token
6. Verify the token unlocks Pro features in the extension

### 10. Deploy to Production

1. Switch to **Live mode** in Stripe
2. Update environment variables with live Price IDs and keys
3. Deploy the updated configuration
4. Complete a real test purchase (small amount first)
5. Verify the full end-to-end flow

## Verification Checklist

- [ ] All 7 products created in Stripe Dashboard
- [ ] All Price IDs copied and saved
- [ ] Webhook endpoint configured and listening to required events
- [ ] Webhook secret copied and saved
- [ ] Live API keys (secret and publishable) saved
- [ ] License secret generated and saved
- [ ] Email service configured and tested
- [ ] Test purchase completed successfully
- [ ] License token email received
- [ ] Token unlocks Pro features in extension

## Troubleshooting

### Webhook not receiving events
- Check the endpoint URL is correct and accessible
- Verify the webhook secret matches
- Check Stripe dashboard webhook delivery logs

### Email not sending
- Verify email service credentials
- Check the email queue directory for failed attempts
- Test email service independently

### License token invalid
- Verify `SIMPLEBEACON_LICENSE_SECRET` matches between backend and extension
- Check the token is not expired
- Ensure the token is being passed correctly in the extension

### Price ID not found
- Verify the Price ID is correct (starts with `price_`)
- Check you're using the correct mode (test vs live)
- Ensure the product is active in Stripe Dashboard

## Next Steps

After Stripe configuration is complete:
1. Complete the end-to-end license flow test
2. Set up the marketing site domain
3. Configure the billing webhook endpoints
4. Test the full purchase flow
