// Example config using environment variables — no hardcoded secrets
const config = {
  apiKey: process.env.API_KEY,
  dbUrl: process.env.DATABASE_URL,
  stripeKey: process.env.STRIPE_SECRET_KEY,
};
module.exports = config;
