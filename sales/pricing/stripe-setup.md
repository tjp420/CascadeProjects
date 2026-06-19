# Stripe Setup Guide

## Step 1: Create Stripe Account

1. Go to https://dashboard.stripe.com/register
2. Sign up with email
3. Complete onboarding:
   - Business type (Individual/Company)
   - Business details
   - Bank account for payouts
   - Personal verification

## Step 2: Create Products

### Product 1: AI Slop Cop Pro (Monthly)

1. Go to Products → Add product
2. Fill in:
   - **Name:** AI Slop Cop Pro (Monthly)
   - **Description:** Full-featured AI code debt detection for individual developers
   - **Pricing:**
     - Price: $9.00 USD
     - Billing: Monthly recurring
   - **Metadata:**
     - `tier`: `pro`
     - `duration`: `monthly`

### Product 2: AI Slop Cop Pro (Yearly)

1. Go to Products → Add product
2. Fill in:
   - **Name:** AI Slop Cop Pro (Yearly)
   - **Description:** Full-featured AI code debt detection - save 17% with annual billing
   - **Pricing:**
     - Price: $90.00 USD
     - Billing: Yearly recurring
   - **Metadata:**
     - `tier`: `pro`
     - `duration`: `yearly`

### Product 3: AI Slop Cop Enterprise

1. Go to Products → Add product
2. Fill in:
   - **Name:** AI Slop Cop Enterprise
   - **Description:** Custom AI code debt detection for teams and enterprises
   - **Pricing:**
     - Price: Custom (set to $1.00 for now, update per customer)
     - Billing: Yearly recurring
   - **Metadata:**
     - `tier`: `enterprise`
     - `duration`: `yearly`

## Step 3: Get API Keys

1. Go to Developers → API keys
2. Copy:
   - **Publishable key:** `pk_live_...`
   - **Secret key:** `sk_live_...`
   - **Webhook signing secret:** (create webhook first, then get this)

## Step 4: Create Webhook

1. Go to Developers → Webhooks → Add endpoint
2. URL: `https://your-domain.com/webhook/stripe`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

4. After creating, copy the **Webhook signing secret**: `whsec_...`

## Step 5: Environment Variables

Add to your deployment environment:

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

For local testing:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Step 6: Test Mode

Before going live:

1. Use test mode in Stripe dashboard
2. Use test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
3. Test checkout flow
4. Verify webhook delivery
5. Verify token generation
6. Verify email delivery

## Step 7: Go Live

1. Switch to live mode in Stripe dashboard
2. Update environment variables with live keys
3. Deploy webhook handler
4. Update webhook endpoint URL in Stripe
5. Test with real payment ($1 test product)
6. Verify end-to-end flow

## Step 8: Customer Portal

Enable Stripe Customer Portal for self-service:

1. Go to Settings → Billing → Customer portal
2. Configure:
   - Products to display
   - Allow plan changes
   - Allow cancellation
   - Update payment method
3. Integrate portal link in your website

## Step 9: Tax Configuration

1. Go to Settings → Tax
2. Configure tax collection:
   - Automatic tax calculation
   - Tax ID collection for B2B
   - VAT for EU customers

## Step 10: Invoicing

1. Go to Settings → Billing
2. Configure:
   - Invoice numbering
   - Invoice logo
   - Payment terms
   - Late fee settings

## Security Checklist

- [ ] Never commit API keys to git
- [ ] Use environment variables
- [ ] Enable webhook signature verification
- [ ] Use HTTPS for all endpoints
- [ ] Implement rate limiting
- [ ] Log all webhook events
- [ ] Set up Stripe Radar for fraud protection
- [ ] Enable 2FA on Stripe account

## Troubleshooting

### Webhook not receiving events
- Check webhook URL is correct
- Verify webhook secret matches
- Check server logs for errors
- Test with Stripe CLI: `stripe trigger checkout.session.completed`

### Token generation failing
- Check token generator script path
- Verify LICENSE_SECRET is set
- Check script permissions
- Test manually: `node generate-license-token.cjs pro`

### Email not sending
- Verify email credentials
- Check email service limits
- Verify email format
- Check spam folder

### Payment not completing
- Check Stripe dashboard for errors
- Verify product is active
- Check webhook is responding
- Test with different card

## Monitoring

Set up alerts for:
- Failed webhooks
- Failed payments
- High refund rates
- Unusual subscription patterns
- API errors

## Resources

- Stripe Docs: https://stripe.com/docs
- Webhooks Guide: https://stripe.com/docs/webhooks
- Checkout Guide: https://stripe.com/docs/payments/checkout
- Customer Portal: https://stripe.com/docs/billing/subscriptions/customer-portal
