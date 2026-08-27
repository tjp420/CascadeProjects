// server/create-session.js
// Helper CLI to create a Stripe Checkout Session in test mode and print the session URL

'use strict';

require('dotenv').config();
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error('ERROR: STRIPE_SECRET_KEY not set in environment. Copy .env.example -> .env and fill test keys.');
  process.exit(1);
}

const stripe = require('stripe')(stripeKey);

async function createSession({ amount = 500, product_name = 'Test Item', domain = `http://localhost:${process.env.PORT || 4242}` } = {}) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: product_name },
            unit_amount: parseInt(amount, 10),
          },
          quantity: 1,
        },
      ],
      success_url: `${domain}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/cancel.html`,
    });

    console.log('Created Checkout Session:');
    console.log('ID:', session.id);
    console.log('URL:', session.url);
    console.log('\nOpen the URL in your browser to complete the test checkout (use Stripe test card 4242 4242 4242 4242).');
  } catch (err) {
    console.error('Failed to create checkout session:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

// CLI args: --amount=500 --product_name="Name" --domain="http://localhost:4242"
const args = process.argv.slice(2);
const opts = {};
args.forEach(arg => {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  if (m) opts[m[1]] = m[2];
});

createSession(opts).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
