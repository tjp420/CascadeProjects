# License Token Distribution System

## Architecture Overview

```
Customer → Stripe → Webhook → Token Generator → Email Service → Customer
                                           ↓
                                    Database (token tracking)
```

## Implementation Steps

### Step 1: Stripe Setup

1. Create Stripe account
2. Create products:
   - AI Slop Cop Pro (Monthly) - $9
   - AI Slop Cop Pro (Yearly) - $90
   - AI Slop Cop Enterprise (Custom)

3. Configure product metadata:
   ```json
   {
     "tier": "pro",
     "duration": "monthly"
   }
   ```

### Step 2: Webhook Endpoint

Create a simple Node.js service:

```javascript
// server.js
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const { execSync } = require('child_process');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.raw({ type: 'application/json' }));

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send();
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details.email;
    const tier = session.metadata.tier;
    
    // Generate token
    const token = execSync(`node ../packages/simplebeacon-cli/bin/generate-license-token.cjs ${tier}`).toString().trim();
    
    // Store in database (implement this)
    await storeToken(token, email, tier);
    
    // Send email
    await sendLicenseEmail(email, token, tier);
  }
  
  res.json({ received: true });
});

async function sendLicenseEmail(email, token, tier) {
  const mailOptions = {
    from: 'noreply@simplebeacon.com',
    to: email,
    subject: 'Your AI Slop Cop License Token',
    html: `
      <h2>Thank you for purchasing AI Slop Cop!</h2>
      <p>Your license token:</p>
      <code style="background: #f0f0f0; padding: 10px; display: block;">${token}</code>
      <h3>To activate:</h3>
      <ol>
        <li>Open VSCode</li>
        <li>Go to Settings > Extensions > AI Slop Cop</li>
        <li>Enter your license token</li>
        <li>Click "Activate"</li>
      </ol>
      <p><strong>Tier:</strong> ${tier.toUpperCase()}</p>
      <p><strong>Valid until:</strong> ${new Date(Date.now() + 365*24*60*60*1000).toLocaleDateString()}</p>
      <p>Need help? Contact <a href="mailto:support@simplebeacon.com">support@simplebeacon.com</a></p>
    `
  };
  
  await transporter.sendMail(mailOptions);
}

async function storeToken(token, email, tier) {
  // Implement database storage
  // Hash the token for security
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  // Store hash, email, tier, issued_at, expires_at
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`License server running on port ${PORT}`));
```

### Step 3: Deployment

#### Option A: Render (Recommended)

1. Create `render.yaml`:
```yaml
services:
  - type: web
    name: ai-slop-cop-license-server
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: STRIPE_SECRET_KEY
        sync: false
      - key: STRIPE_WEBHOOK_SECRET
        sync: false
      - key: EMAIL_USER
        sync: false
      - key: EMAIL_PASS
        sync: false
```

2. Deploy to Render
3. Configure Stripe webhook URL

#### Option B: Vercel

1. Create `api/webhook.js`:
```javascript
export default async function handler(req, res) {
  // Same logic as above
}
```

2. Deploy to Vercel
3. Configure Stripe webhook URL

### Step 4: Database (Optional but Recommended)

For token tracking and revocation:

```sql
-- PostgreSQL schema
CREATE TABLE licenses (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255),
  tier VARCHAR(20) NOT NULL,
  issued_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255)
);

CREATE INDEX idx_token_hash ON licenses(token_hash);
CREATE INDEX idx_email ON licenses(email);
```

### Step 5: Environment Variables

Required environment variables:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
DATABASE_URL=postgresql://...
LICENSE_SECRET=fb578fe0edf57520edd3b1b53477fbafb20a43ee3d0162feb02974ca990cca54
```

## Testing

### Local Testing

1. Use Stripe CLI for local webhooks:
```bash
stripe listen --forward-to localhost:3000/webhook/stripe
```

2. Create a test checkout session
3. Verify token generation
4. Verify email delivery

### Production Testing

1. Create a $1 test product
2. Complete purchase
3. Verify token delivery
4. Verify token activation in VSCode

## Monitoring

Add logging for:
- Webhook receipts
- Token generation
- Email delivery
- Errors/failures

## Security Checklist

- [ ] Verify Stripe webhook signatures
- [ ] Use HTTPS for all endpoints
- [ ] Hash tokens in database
- [ ] Never log raw tokens
- [ ] Rotate LICENSE_SECRET annually
- [ ] Rate limit webhook endpoint
- [ ] Implement IP whitelist (optional)
- [ ] Use app-specific email password
