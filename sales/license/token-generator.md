# License Token Generation System

## Overview

AI Slop Cop uses JWT-based license tokens to validate subscriptions and enable Pro/Enterprise features.

## Current Implementation

### Token Generator Script
Location: `packages/simplebeacon-cli/bin/generate-license-token.cjs`

### Usage

```bash
# Generate a Pro tier token
node packages/simplebeacon-cli/bin/generate-license-token.cjs pro

# Generate an Enterprise tier token
node packages/simplebeacon-cli/bin/generate-license-token.cjs enterprise
```

### Token Structure

Tokens are JWTs containing:
- `tier`: "free" | "pro" | "enterprise"
- `email`: Customer email (optional)
- `exp`: Expiration timestamp
- `iat`: Issued at timestamp

### License Secret

The secret is stored in `vscode-extension/src/extension.ts`:
```typescript
const LICENSE_SECRET = 'fb578fe0edf57520edd3b1b53477fbafb20a43ee3d0162feb02974ca990cca54';
```

**IMPORTANT:** This secret must be kept secure. It validates all tokens.

## Distribution System Options

### Option 1: Manual Distribution (Quick Start)

1. Customer purchases via Stripe
2. Admin receives notification
3. Admin generates token manually
4. Admin emails token to customer
5. Customer enters token in VSCode settings

**Pros:** Simple, no infrastructure needed
**Cons:** Manual, not scalable, slow delivery

### Option 2: Automated Webhook (Recommended)

1. Customer purchases via Stripe
2. Stripe webhook triggers backend
3. Backend generates token automatically
4. Backend emails token to customer
5. Customer enters token in VSCode settings

**Pros:** Automated, scalable, fast
**Cons:** Requires backend infrastructure

### Option 3: Self-Service Portal

1. Customer purchases via Stripe
2. Customer receives link to portal
3. Customer logs in and retrieves token
4. Customer enters token in VSCode settings

**Pros:** Customer control, reduced support
**Cons:** Requires authentication system

## Recommended Implementation (Option 2)

### Backend Requirements

```javascript
// Simple webhook handler (Node.js/Express)
const express = require('express');
const crypto = require('crypto');
const { execSync } = require('child_process');

const app = express();
app.use(express.raw({ type: 'application/json' }));

app.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  // Verify webhook signature
  const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details.email;
    const tier = session.metadata.tier; // 'pro' or 'enterprise'
    
    // Generate token
    const token = execSync(`node generate-license-token.cjs ${tier}`).toString().trim();
    
    // Send email
    await sendLicenseEmail(email, token, tier);
  }
  
  res.json({ received: true });
});
```

### Email Template

```
Subject: Your AI Slop Cop License Token

Thank you for purchasing AI Slop Cop!

Your license token:
[TOKEN]

To activate:
1. Open VSCode
2. Go to Settings > Extensions > AI Slop Cop
3. Enter your license token
4. Click "Activate"

Tier: [TIER]
Valid until: [EXPIRATION DATE]

Need help? Contact support@simplebeacon.com
```

## Token Management

### Database Schema

```sql
CREATE TABLE licenses (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255),
  tier VARCHAR(20) NOT NULL,
  issued_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  customer_id VARCHAR(255)
);
```

### Token Revocation

To revoke a token:
1. Mark as revoked in database
2. Extension checks revocation status periodically
3. Disable features if revoked

### Token Expiration

- Pro: 1 year from purchase
- Enterprise: 1 year from purchase
- Auto-renewal handled by Stripe

## Security Considerations

1. **Secret Management**
   - Store LICENSE_SECRET in environment variable
   - Rotate secret annually
   - Never commit to git

2. **Token Storage**
   - Hash tokens in database
   - Encrypt at rest
   - Use secure transmission (HTTPS)

3. **Webhook Security**
   - Verify Stripe signatures
   - Rate limit endpoints
   - Log all token generation

## Testing

```bash
# Generate test token
node packages/simplebeacon-cli/bin/generate-license-token.cjs pro

# Test validation in extension
# 1. Open VSCode
# 2. Settings > simplebeacon.licenseToken
# 3. Paste token
# 4. Check tier in sidebar
```

## Next Steps

1. Set up Stripe account
2. Create pricing plans
3. Implement webhook handler
4. Set up email service (SendGrid/Mailgun)
5. Deploy to hosting (Render/Vercel)
6. Test end-to-end flow
