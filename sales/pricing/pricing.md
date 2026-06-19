# AI Slop Cop Pricing

## Pricing Tiers

### Free Tier
- **Price:** $0
- **Features:**
  - Basic scanning (24 real-time regex rules)
  - File-by-file scanning in VSCode
  - Basic diagnostic reporting
  - Gate evaluation (errors only)
- **Limitations:**
  - No batch CLI scanning
  - No advanced rules (14 batch engines)
  - No CI/CD integration
  - No priority support

### Pro Tier
- **Price:** $9/month or $90/year (17% savings)
- **Features:**
  - All Free features
  - Full scanning (38 analyzer engines)
  - Batch CLI scanning
  - CI/CD gate integration
  - Export reports (JSON, Markdown)
  - Priority email support
  - Custom rule configurations
- **Best for:** Individual developers, small teams

### Enterprise Tier
- **Price:** Custom (contact sales)
- **Features:**
  - All Pro features
  - Team management (5+ seats)
  - SSO authentication
  - Custom rule development
  - Dedicated support channel
  - SLA guarantee
  - On-premise deployment option
- **Best for:** Large teams, enterprises

## Pricing Strategy

### Monthly vs Yearly
- Monthly: $9/month (flexible, cancel anytime)
- Yearly: $90/year (save $18, billed annually)
- Enterprise: Custom pricing based on team size

### Volume Discounts (Enterprise)
- 5-10 seats: 10% discount
- 11-25 seats: 20% discount
- 26-50 seats: 30% discount
- 50+ seats: Custom pricing

### Free Trial
- Free tier serves as unlimited trial
- No time limit
- Upgrade to Pro/Enterprise anytime
- Pro trial available on request (7 days)

## Competitive Analysis

| Feature | AI Slop Cop | SonarQube | CodeQL | Snyk |
|---------|-------------|-----------|--------|------|
| Price | $9/mo | $150+/mo | Free (GitHub) | $50+/mo |
| AI-specific rules | ✅ | ❌ | ❌ | ❌ |
| Local scanning | ✅ | ❌ | ✅ | ❌ |
| CI/CD integration | ✅ | ✅ | ✅ | ✅ |
| VSCode extension | ✅ | ✅ | ❌ | ✅ |
| Privacy-first | ✅ | ❌ | ✅ | ❌ |

## Payment Processing

### Stripe Integration

#### Products to Create

1. **AI Slop Cop Pro (Monthly)**
   - Price: $9.00 USD
   - Recurring: Monthly
   - Metadata: `{"tier": "pro", "duration": "monthly"}`

2. **AI Slop Cop Pro (Yearly)**
   - Price: $90.00 USD
   - Recurring: Yearly
   - Metadata: `{"tier": "pro", "duration": "yearly"}`

3. **AI Slop Cop Enterprise**
   - Price: Custom
   - Recurring: Yearly
   - Metadata: `{"tier": "enterprise", "duration": "yearly"}`

#### Checkout Flow

```javascript
// Stripe Checkout Session
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{
    price: priceId,
    quantity: 1,
  }],
  mode: 'subscription',
  success_url: 'https://simplebeacon.com/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://simplebeacon.com/pricing',
  customer_email: customerEmail,
  metadata: {
    tier: 'pro',
    duration: 'monthly'
  }
});
```

### Pricing Page HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>AI Slop Cop Pricing</title>
  <style>
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .pricing-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 2rem;
      text-align: center;
    }
    .pricing-card.featured {
      border: 2px solid #3b82f6;
      transform: scale(1.05);
    }
    .price {
      font-size: 3rem;
      font-weight: bold;
      margin: 1rem 0;
    }
    .price span {
      font-size: 1rem;
      color: #666;
    }
    .features {
      list-style: none;
      padding: 0;
      text-align: left;
      margin: 2rem 0;
    }
    .features li {
      padding: 0.5rem 0;
    }
    .features li::before {
      content: "✓ ";
      color: green;
    }
    .cta-button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 1rem 2rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="pricing-grid">
    <div class="pricing-card">
      <h2>Free</h2>
      <div class="price">$0<span>/month</span></div>
      <ul class="features">
        <li>Basic scanning (24 rules)</li>
        <li>VSCode extension</li>
        <li>Basic diagnostics</li>
        <li>Gate evaluation</li>
      </ul>
      <button class="cta-button" onclick="installExtension()">Install Free</button>
    </div>
    
    <div class="pricing-card featured">
      <h2>Pro</h2>
      <div class="price">$9<span>/month</span></div>
      <p style="color: #666;">or $90/year (save 17%)</p>
      <ul class="features">
        <li>All Free features</li>
        <li>Full scanning (38 engines)</li>
        <li>Batch CLI scanning</li>
        <li>CI/CD integration</li>
        <li>Export reports</li>
        <li>Priority support</li>
      </ul>
      <button class="cta-button" onclick="subscribe('monthly')">Subscribe Monthly</button>
      <button class="cta-button" onclick="subscribe('yearly')" style="margin-top: 0.5rem;">Subscribe Yearly</button>
    </div>
    
    <div class="pricing-card">
      <h2>Enterprise</h2>
      <div class="price">Custom</div>
      <ul class="features">
        <li>All Pro features</li>
        <li>Team management</li>
        <li>SSO authentication</li>
        <li>Custom rules</li>
        <li>Dedicated support</li>
        <li>SLA guarantee</li>
      </ul>
      <button class="cta-button" onclick="contactSales()">Contact Sales</button>
    </div>
  </div>
  
  <script>
    function installExtension() {
      window.location.href = 'https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop';
    }
    
    async function subscribe(duration) {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'pro', duration })
      });
      const { url } = await response.json();
      window.location.href = url;
    }
    
    function contactSales() {
      window.location.href = 'mailto:sales@simplebeacon.com?subject=Enterprise Inquiry';
    }
  </script>
</body>
</html>
```

## Refund Policy

### Pro Tier
- 7-day money-back guarantee
- No questions asked
- Refund processed within 5 business days
- License token revoked after refund

### Enterprise Tier
- Custom refund terms in contract
- Typically 30-day evaluation period
- Pro-rated refunds for annual subscriptions

### Free Tier
- No refunds (free product)

## Tax Considerations

- Sales tax collected where required by law
- VAT for EU customers
- Customers receive tax invoice
- Enterprise customers can provide VAT ID

## Payment Methods

- Credit/Debit Cards (Visa, Mastercard, Amex)
- PayPal (via Stripe)
- Bank transfer (Enterprise only)
- Invoice (Enterprise only)

## Subscription Management

### Customer Portal
- View subscription status
- Update payment method
- Change plan (monthly/yearly)
- Cancel subscription
- Download invoices

### Cancellation
- Cancel anytime
- Access until end of billing period
- No cancellation fees
- Auto-renewal disabled

## Upcoming Pricing Changes

Any pricing changes will:
- Be announced 30 days in advance
- Apply only to new subscriptions
- Grandfather existing customers
- Be communicated via email and in-app notification
