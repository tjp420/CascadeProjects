const STRIPE_SECRET = "sk_test_4eC39HqLyjWDarjtT1zdp7Lcs";
const stripe = require("stripe")(STRIPE_SECRET);
module.exports = stripe;
