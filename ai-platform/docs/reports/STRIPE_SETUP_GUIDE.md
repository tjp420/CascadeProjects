# Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payment processing for the AI Coding Intelligence Dashboard.

## Prerequisites

- Node.js 14+ installed
- npm or yarn package manager
- A Stripe account (free to sign up at https://stripe.com)

## Quick Start

### 1. Install Dependencies

```bash
npm install express stripe cors body-parser dotenv
```

### 2. Run the Setup Script

```bash
node scripts/setup-stripe.js
```

This will guide you through:
- Entering your Stripe API keys
- Creating a `.env` file with your configuration
- Providing instructions for creating products in Stripe

### 3. Create Stripe Products and Prices

1. Log into your Stripe Dashboard: https://dashboard.stripe.com
2. Navigate to **Products** → **Add product**
3. Create the following products:

#### Basic Plan
- **Name**: Basic Plan - AI Coding Intelligence
- **Description**: Perfect for individual developers and small projects
- **Price**: $29/month
- **Features**: 
  - 100 scans/month
  - Basic code analysis
  - Email support
  - Standard reports

#### Pro Plan
- **Name**: Pro Plan - AI Coding Intelligence
- **Description**: For professional developers and growing teams
- **Price**: $79/month
- **Features**:
  - Unlimited scans
  - Advanced AI analysis
  - Priority support
  - API access
  - Advanced reports
  - Custom integrations

#### Enterprise Plan
- **Name**: Enterprise Plan - AI Coding Intelligence
- **Description**: For large teams and enterprise organizations
- **Price**: $199/month
- **Features**:
  - Everything in Pro
  - Dedicated support
  - SLA guarantees
  - Custom development
  - Team collaboration
  - Advanced analytics

4. For each product, create a monthly recurring price
5. Copy the Price IDs (they look like `price_xxxxxxxx`)

### 4. Update Environment Variables

Update your `.env` file with the Price IDs:

```env
STRIPE_BASIC_PRICE_ID=price_xxxxxxxx
STRIPE_PRO_PRICE_ID=price_yyyyyyyy
STRIPE_ENTERPRISE_PRICE_ID=price_zzzzzzzz
```

### 5. Set Up Webhooks

1. Go to **Webhooks** in your Stripe Dashboard
2. Click **Add endpoint**
3. Set endpoint URL: `https://your-domain.com/api/webhook`
   - For local testing, use: `http://localhost:3000/api/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret and update your `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
   ```

### 6. Start the Server

```bash
npm start
```

The Stripe payment server will run on port 3000 (or the port specified in your `.env` file).

### 7. Update Client-Side Configuration

Update `web/stripe-integration.js` with your Stripe publishable key:

```javascript
this.stripePublicKey = process.env.STRIPE_PUBLIC_KEY || 'pk_test_your_actual_key';
```

## Testing Your Integration

### Test Mode

Stripe provides test mode that allows you to test your integration without processing real payments:

1. Ensure you're using test keys (keys starting with `pk_test_` and `sk_test_`)
2. Use Stripe test card numbers: https://stripe.com/docs/testing

### Test Cards

Use these test card numbers in Stripe test mode:

- **Successful payment**: `4242 4242 4242 4242`
- **Payment declined**: `4000 0000 0000 0002`
- **Insufficient funds**: `4000 0000 0000 9995`
- **Expired card**: `4000 0000 0000 0069`

For any test card, use:
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **Postal code**: Any 5 digits

## API Endpoints

The server provides the following endpoints:

### `POST /api/create-checkout-session`
Creates a Stripe checkout session for subscription.

**Request:**
```json
{
  "priceId": "price_xxxxxxxx",
  "customerEmail": "user@example.com"
}
```

**Response:**
```json
{
  "id": "cs_xxxxxxxx",
  "url": "https://checkout.stripe.com/..."
}
```

### `GET /api/subscription-status`
Gets the current subscription status for a user.

**Headers:**
```
X-User-Id: user_123
```

**Response:**
```json
{
  "status": "active",
  "tier": "pro",
  "currentPeriodEnd": "2024-12-31T23:59:59.000Z",
  "cancelAtPeriodEnd": false
}
```

### `POST /api/cancel-subscription`
Cancels a subscription at the end of the current period.

**Headers:**
```
X-User-Id: user_123
```

### `POST /api/update-subscription`
Updates a subscription (upgrade/downgrade).

**Request:**
```json
{
  "priceId": "price_yyyyyyyy"
}
```

**Headers:**
```
X-User-Id: user_123
```

### `POST /api/billing-portal`
Creates a billing portal session for managing subscriptions.

**Headers:**
```
X-User-Id: user_123
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

### `POST /api/webhook`
Handles Stripe webhook events.

## Security Considerations

### Production Keys

- Never commit your Stripe secret keys to version control
- Use environment variables for all sensitive data
- Use different keys for test and production environments
- Rotate your keys periodically

### Webhook Security

- Always verify webhook signatures using the webhook secret
- Use HTTPS in production
- Implement idempotency keys for webhook processing

### PCI Compliance

- Stripe handles PCI compliance for you
- Never store raw credit card information
- Use Stripe Elements for custom payment forms

## Troubleshooting

### Common Issues

**Issue**: "No such payment_method: xxxxx"
- **Solution**: Ensure the price ID is correct and the product exists in Stripe

**Issue**: "Webhook signature verification failed"
- **Solution**: Check that your webhook secret is correct in the `.env` file

**Issue**: "Customer already has an active subscription"
- **Solution**: Check if the customer already has a subscription before creating a new one

**Issue**: CORS errors when calling API
- **Solution**: Ensure the server CORS configuration includes your frontend domain

### Debug Mode

Enable debug logging by setting:

```env
NODE_ENV=development
```

## Going Live

### Steps to Go Live

1. **Switch to Live Keys**
   - Replace test keys with live keys in your `.env` file
   - Live keys start with `pk_live_` and `sk_live_`

2. **Update Webhooks**
   - Create new webhook endpoints for your production domain
   - Update the webhook secret in your environment variables

3. **Create Live Products**
   - Recreate products and prices in live mode
   - Update the price IDs in your configuration

4. **Test Thoroughly**
   - Run through the entire payment flow with live test payments
   - Test subscription upgrades, downgrades, and cancellations
   - Verify webhook handling

5. **Monitor Transactions**
   - Set up Stripe Radar for fraud detection
   - Configure email notifications for important events
   - Regularly review transactions in the Stripe Dashboard

## Support

- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- API Status: https://status.stripe.com

## Additional Resources

- [Stripe Subscriptions Guide](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Checkout Guide](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Guide](https://stripe.com/docs/testing)