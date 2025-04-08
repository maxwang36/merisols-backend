const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Define this as '/' because it's already mounted at '/api/stripe/webhook'
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('✅ Stripe signature verified:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const subscriptionId = session.subscription;
    const userId = session.metadata?.user_id; // 👈 Your custom user_id
    const customerEmail = session.customer_email;

    if (!userId) {
      console.error('❌ No user_id found in session metadata.');
      return res.status(400).send('Missing user_id in metadata.');
    }

    console.log('✅ Checkout session completed for:', customerEmail);
    console.log('🔗 user_id from metadata:', userId);

    try {
      // Get subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0].price.id;
      console.log('💰 Stripe Price ID:', priceId);

      // Get the corresponding plan from Supabase
      const { data: plan, error: planError } = await supabase
        .from('plan')
        .select('plan_id')
        .eq('stripe_price_id', priceId)
        .single();
        console.log('📦 Raw plan data:', plan);
        console.log('🔍 Stripe price ID looked for:', priceId);
      if (planError || !plan) {
        console.error('❌ Failed to fetch plan:', planError?.message);
        return res.status(500).send('Plan not found.');
      }

      // Insert subscription into Supabase
      const { error: insertError } = await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: plan.plan_id,
        start_date: new Date(subscription.start_date * 1000),
        end_date: new Date(subscription.current_period_end * 1000),
        status: 'active'
      });

      if (insertError) {
        console.error('❌ Failed to insert subscription:', insertError.message);
        return res.status(500).send('Database insert error.');
      }

      console.log('✅ Subscription inserted into Supabase for user:', userId);
    } catch (err) {
      console.error('❌ Error processing subscription:', err.message);
      return res.status(500).send('Subscription processing error.');
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;
