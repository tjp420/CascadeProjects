// server/index.js
// Minimal local test server for Stripe Checkout + webhook testing (Test mode only)

'use strict';

require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4242;

const ENABLE_STAGING_TEST_CHECKOUT = process.env.ENABLE_STAGING_TEST_CHECKOUT === '1';
if (!ENABLE_STAGING_TEST_CHECKOUT) {
  console.log('Staging test checkout disabled. To enable set ENABLE_STAGING_TEST_CHECKOUT=1');
} else {
  console.log('Staging test checkout ENABLED');
}

// Serve minimal static success/cancel pages, but guard the staging test page
app.use((req, res, next) => {
  const protectedPaths = ['/test-checkout.html'];
  if (protectedPaths.includes(req.path) && !ENABLE_STAGING_TEST_CHECKOUT) {
    return res.status(404).send('Not found');
  }
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Webhook endpoint must use raw body for signature verification
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Received event:', event.type);
  // Minimal handling for demo purposes
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('Checkout completed:', event.data.object.id);
      break;
    case 'payment_intent.succeeded':
      console.log('PaymentIntent succeeded:', event.data.object.id);
      break;
    case 'charge.refunded':
      console.log('Charge refunded:', event.data.object.id);
      break;
    default:
      // console.log(`Unhandled event type ${event.type}`);
      break;
  }
  res.json({ received: true });
});

// Create a Checkout Session and return the hosted URL (only when staging test checkout is enabled)
if (ENABLE_STAGING_TEST_CHECKOUT) {
  app.post('/create-checkout-session', express.json(), async (req, res) => {
    const domain = req.body.domain || `http://localhost:${PORT}`;
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: req.body.product_name || 'Test product' },
              unit_amount: req.body.amount || 500,
            },
            quantity: 1,
          },
        ],
        success_url: `${domain}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${domain}/cancel.html`,
      });
      res.json({ url: session.url, id: session.id });
    } catch (err) {
      console.error('Error creating checkout session:', err);
      res.status(500).json({ error: err.message });
    }
  });
} else {
  // Provide a safe 404 for the endpoint when not enabled
  app.post('/create-checkout-session', express.json(), (req, res) => {
    res.status(404).json({ error: 'Staging test checkout is disabled' });
  });
}

app.listen(PORT, () => console.log(`Stripe test server listening on http://localhost:${PORT}`));

module.exports = app;
