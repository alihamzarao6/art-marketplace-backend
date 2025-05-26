// Stripe configuration
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const config = require("./config");

module.exports = stripe;