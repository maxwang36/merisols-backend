// backend/routes/stripe.js
const express = require('express');
const router = express.Router();
// Ensure dotenv is configured in main index.js or here if needed
// require('dotenv').config();

// Initialize Stripe with the TEST secret key from .env file
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Define Price IDs from the Stripe Dashboard (TEST MODE)
const PRICE_IDS = {
  monthly: 'price_1RGiScIsXxOfBrotdm6rGzYh',
  yearly: 'price_1RGibUIsXxOfBrotLe68CbLF'
};


const checkAuth = async (req, res, next) => {
  // User is authenticated check
  console.log("User authentication check placeholder");
  next();
};


// POST /api/stripe/create-checkout-session
router.post('/create-checkout-session', checkAuth, async (req, res) => {
  const { plan, userId } = req.body; // 'monthly' or 'yearly'

  console.log(`Received request to create checkout session for plan: ${plan}`);

  // Validate plan and get the corresponding Price ID
  let priceId;
  if (plan === 'Monthly' || plan === 'monthly') {
    priceId = PRICE_IDS.monthly;
  } else if (plan === 'Yearly' || plan === 'yearly') {
    priceId = PRICE_IDS.yearly;
  } else {
    console.error(`Invalid plan type received: ${plan}`);
    return res.status(400).json({ success: false, message: 'Invalid subscription plan selected.' });
  }

  if (!priceId || !priceId.startsWith('price_')) {
      console.error(`Missing or invalid Stripe Price ID for plan '${plan}'. Used ID: '${priceId}'`);
      return res.status(500).json({ success: false, message: `Configuration error: Stripe Price ID for ${plan} plan is not set correctly on the backend.` });
  }

  // Define frontend URLs (replace with actual deployed URLs later)
  const YOUR_DOMAIN = process.env.FRONTEND_URL || 'http://localhost:3000'; // Use env var or default

  try {
    console.log(`Creating Stripe Checkout session for Price ID: ${priceId}`);

    // Create a Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // Use the Price ID from Stripe
          quantity: 1,
        },
      ],
      mode: 'payment', // Set mode to subscription
      success_url: `${YOUR_DOMAIN}/subscription-success?session_id={CHECKOUT_SESSION_ID}`, // Redirect URL on success
      cancel_url: `${YOUR_DOMAIN}/subscribe`, // Redirect URL on cancellation
      // customer_email: req.user?.email
      metadata: {
        user_id: userId, //  Pass custom user_id here
        plan_price_id: priceId
      },
    });

    console.log(`Stripe session created successfully: ${session.id}`);
    // Send the session ID or URL back to the frontend
    res.json({ success: true, url: session.url, sessionId: session.id });

  } catch (error) {
    console.error('Stripe Checkout Session Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create checkout session.', error: error.message });
  }
});

module.exports = router;