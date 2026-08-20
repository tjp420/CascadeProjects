# Payment and Billing Checklist

## Stripe Integration Checklist

### Prerequisites
- [ ] Stripe account created and verified
- [ ] API keys obtained (Publishable and Secret)
  - **Sandbox Keys**: Use `<stripe-pk-placeholder>` (Publishable) and `<stripe-sk-placeholder>` (Secret)
  - **Production Keys**: Replace with real keys only after security review
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] CORS settings configured for frontend domain
- [ ] Environment variables set up securely (never commit keys)

### Checkout Implementation
- [ ] Stripe.js library integrated on frontend
- [ ] Checkout form implemented with validation
- [ ] Payment method collection (card details)
- [ ] Client-side token generation before submission
- [ ] Server-side payment processing with secure key handling
- [ ] Success/failure response handlers
- [ ] Error handling and user messaging
- [ ] PCI compliance verified (no raw card data in server logs)

### Subscriptions
- [ ] Subscription product created in Stripe Dashboard
- [ ] Price tiers defined (monthly, annual, per-usage)
- [ ] Customer creation endpoint implemented
- [ ] Subscription creation endpoint implemented
- [ ] Subscription listing/retrieval endpoint
- [ ] Subscription update endpoint (e.g., changing price tier)
- [ ] Subscription cancellation endpoint
- [ ] Cancellation reason tracking
- [ ] Grace period handling (if applicable)
- [ ] Automatic invoice generation verified

### Webhooks
- [ ] Webhook endpoint registered (`/webhooks/stripe`)
- [ ] Signature verification implemented using secret key
- [ ] Idempotency handling (event deduplication via event ID)
- [ ] Event log/audit trail created
- [ ] Webhook timeout handling
- [ ] Retry logic for transient failures
- [ ] Dead-letter queue for failed events
- [ ] All critical events monitored:
  - [ ] `payment_intent.succeeded`
  - [ ] `payment_intent.payment_failed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.created`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`

---

## Test Scenarios

### 1. Successful Payment
**Setup**: Use Stripe test card `4242 4242 4242 4242` with valid expiry
- [ ] User submits checkout form
- [ ] Payment intent created successfully
- [ ] Webhook received: `payment_intent.succeeded`
- [ ] Invoice generated and stored
- [ ] User subscription activated
- [ ] Confirmation email sent
- [ ] Dashboard shows active status
- [ ] Idempotency: Retrying same request doesn't double-charge

### 2. Card Decline (Insufficient Funds)
**Setup**: Use Stripe test card `4000 0000 0000 0002`
- [ ] Error message displayed: "Card declined"
- [ ] Payment intent marked as failed
- [ ] Webhook received: `payment_intent.payment_failed`
- [ ] User not charged
- [ ] Subscription not activated
- [ ] Retry link/option provided to user
- [ ] Failure logged with timestamp and reason

### 3. Failed Webhook Delivery
**Setup**: Simulate network timeout or 5xx response
- [ ] Webhook retry mechanism triggered (Stripe retries for ~72 hours)
- [ ] Event stored in database with `pending` status
- [ ] Manual replay capability available
- [ ] No duplicate processing on retry
- [ ] Alert system notifies ops team if retries exhausted
- [ ] Recovery procedure documented and tested

### 4. Subscription Upgrade
**Setup**: Customer on $10/month, upgrade to $25/month
- [ ] Subscription updated via `stripe.subscriptions.update()`
- [ ] Webhook received: `customer.subscription.updated`
- [ ] Pro-rata credit calculated and applied
- [ ] Invoice adjustment generated
- [ ] New price effective immediately (or next billing cycle based on policy)
- [ ] Confirmation email sent
- [ ] Dashboard reflects new plan immediately

### 5. Subscription Downgrade
**Setup**: Customer on $25/month, downgrade to $10/month
- [ ] Subscription updated with new price tier
- [ ] Webhook received: `customer.subscription.updated`
- [ ] Credit applied to account (or refund processed based on policy)
- [ ] Effective date clearly communicated to user
- [ ] Downgrade reason tracked (if applicable)
- [ ] Confirmation email sent
- [ ] No service interruption during transition

### 6. Subscription Cancellation
**Setup**: User initiates cancellation
- [ ] Cancellation processed immediately or at period end (configurable)
- [ ] Webhook received: `customer.subscription.deleted`
- [ ] Final invoice generated if applicable
- [ ] Cancellation reason logged
- [ ] Access revoked at appropriate time
- [ ] Confirmation email with next steps
- [ ] Reactivation option available for N days

---

## Webhook Verification and Idempotency

### Signature Verification
```
1. Extract Stripe signature from header: `stripe-signature`
2. Construct signed content: `{timestamp}.{payload}`
3. Compute HMAC-SHA256 using webhook secret: `<stripe-webhook-secret-placeholder>`
4. Compare computed signature with provided signature
5. Verify timestamp is within acceptable window (e.g., 5 minutes)
6. Reject if signature invalid or timestamp expired
```

**Pseudocode**:
```javascript
const signature = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  req.rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
// Continue processing only if constructEvent succeeds
```

### Idempotency Handling
- Store webhook event ID with timestamp in database
- Before processing, check if event ID already processed
- If found, return success (don't reprocess)
- Use database transaction to ensure atomic check-and-store

**Pseudocode**:
```javascript
const eventId = event.id;
const existing = await db.webhookEvents.findOne({ eventId });
if (existing) {
  return res.json({ received: true, cached: true });
}
// Process event...
await db.webhookEvents.insert({ eventId, event, processedAt: now });
return res.json({ received: true });
```

---

## Sandbox Test Keys and Instructions

### Obtaining Sandbox Keys
1. Log into [Stripe Dashboard](https://dashboard.stripe.com) (test mode)
2. Navigate to Developers → API Keys
3. Copy **Publishable Key** → `<stripe-pk-placeholder>`
4. Copy **Secret Key** → `<stripe-sk-placeholder>`
5. Copy **Webhook Signing Secret** → `<stripe-webhook-secret-placeholder>`

### Environment Setup
```bash
# .env.local (development)
VITE_STRIPE_PUBLISHABLE_KEY=<stripe-pk-placeholder>
STRIPE_SECRET_KEY=<stripe-sk-placeholder>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret-placeholder>
```

### Running Tests

#### Syntax Check
```bash
node -c ./ai-platform/server/routes/stripe-webhook-routes.cjs
node -c ./ai-platform/server/routes/stripe-webhook-hardening.test.cjs
```

#### Unit Tests
```bash
npm test -- --testPathPattern=stripe
```

#### Integration Test: Simulate Successful Payment
```bash
node ./scripts/test-stripe-webhook.cjs --event payment_intent.succeeded
```

#### Integration Test: Simulate Failed Payment
```bash
node ./scripts/test-stripe-webhook.cjs --event payment_intent.payment_failed
```

#### Local Webhook Testing with Stripe CLI
```bash
# Install Stripe CLI
# (macOS) brew install stripe/stripe-cli/stripe
# (Linux) curl https://raw.githubusercontent.com/stripe/stripe-cli/master/install.sh | bash
# (Windows) choco install stripe-cli

# Authenticate
stripe login

# Forward webhooks to local endpoint
stripe listen --forward-to localhost:3000/webhooks/stripe

# Trigger test event
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
```

---

## Billing Email Templates

### Template 1: Invoice Notification
```
Subject: Your SimpleBeacon Invoice #INV-20260819-001

Hi {Customer Name},

Thank you for using SimpleBeacon. Your invoice for the month of August 2026 is ready.

---
Invoice Details:
Invoice Number: INV-20260819-001
Billing Period: August 1 - August 31, 2026
Plan: Enterprise - Annual
Amount Due: $2,400.00
Due Date: September 5, 2026

---
Description                    Quantity    Unit Price    Amount
SimpleBeacon Enterprise Plan       1       $200/mo       $2,400.00
                                                Total:    $2,400.00

---
Payment Method: {Last 4 digits of card}
Status: Pending

[View Invoice in Dashboard]

If you have questions about this invoice, reply to this email or contact our support team at billing@simplebeacon.io.

Best regards,
SimpleBeacon Billing Team
```

### Template 2: Payment Failed Notification
```
Subject: ⚠️ Payment Failed for Your SimpleBeacon Subscription

Hi {Customer Name},

We were unable to process your payment for SimpleBeacon. Your subscription is at risk of being suspended.

---
Payment Details:
Amount: ${Amount}
Date Attempted: {Date}
Reason: {Failure Reason}
  Example: "Card expired" / "Insufficient funds" / "Card declined"

---
Next Steps:
1. Update your payment method [here]
2. Retry payment manually [here]
3. Or, we'll retry automatically in 3 days

If payment is not resolved within 7 days, your subscription will be suspended.

---
Update Payment Method:
[Click here to update card details]

For assistance, contact support@simplebeacon.io or call {PHONE}.

Best regards,
SimpleBeacon Billing Team
```

### Template 3: Subscription Renewal Confirmation
```
Subject: Your SimpleBeacon Subscription Has Been Renewed ✓

Hi {Customer Name},

Great news! Your subscription renewal was successful.

---
Renewal Details:
Plan: {Plan Name}
Billing Cycle: {Start Date} - {End Date}
Amount Charged: ${Amount}
Invoice Number: INV-{InvoiceId}
Payment Method: {Card ending in XXXX}

---
Service Active Until: {Next Billing Date}

Thank you for your continued trust in SimpleBeacon. If you have any questions, reply to this email.

Best regards,
SimpleBeacon Billing Team
```

### Template 4: Subscription Cancellation Confirmation
```
Subject: Your SimpleBeacon Subscription Has Been Cancelled

Hi {Customer Name},

We've processed your subscription cancellation.

---
Cancellation Details:
Plan: {Plan Name}
Cancellation Date: {Date}
Final Charge: ${Final Amount} (if applicable)
Access Ends: {Access End Date}

---
We're sorry to see you go. If you'd like to provide feedback on why you're leaving, 
please reply to this email—we'd love to hear from you.

Reactivation:
You can reactivate your subscription anytime within the next 30 days [here].

Best regards,
SimpleBeacon Billing Team
```

### Template 5: Subscription Downgrade Confirmation
```
Subject: Your SimpleBeacon Plan Has Been Downgraded

Hi {Customer Name},

Your subscription plan has been successfully changed.

---
Plan Change Details:
Previous Plan: {Old Plan} - ${Old Price}/month
New Plan: {New Plan} - ${New Price}/month
Effective Date: {Effective Date}
Credit Applied: ${Credit Amount} (if applicable)

---
New Invoice:
Invoice Number: INV-{InvoiceId}
Amount Due: ${New Amount}
Due Date: {Due Date}

---
Your access to Enterprise features will be removed on {Date}.
You'll have until then to migrate any dependent configurations.

If you have any questions, contact support@simplebeacon.io.

Best regards,
SimpleBeacon Billing Team
```

---

## Implementation Checklist Summary

- [ ] All checklist items reviewed and assigned
- [ ] Test scenarios documented and validated
- [ ] Webhook security measures implemented
- [ ] Email templates created and branded
- [ ] Sandbox credentials stored securely
- [ ] Monitoring alerts configured
- [ ] Support runbook created
- [ ] Customer communication plan approved
- [ ] Compliance review completed (PCI, GDPR, etc.)
- [ ] Staging environment payment tests passed
- [ ] Production deployment scheduled

---

**Last Updated**: August 19, 2026  
**Status**: Draft  
**Owner**: Payment & Billing Team  
**Next Review**: After production deployment
