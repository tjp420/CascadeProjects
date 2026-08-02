// Wrapper to set env var and run the webhook sender (avoids shell quoting issues)
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_local';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
require('./send-test-stripe-webhook.cjs');
