const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Webhook handler
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('Stripe signature verified:', event.type);
  } catch (err) {
    console.error(' Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata || {};
    console.log("Metadata received:", metadata);

    const userId = metadata.user_id;
    const planPriceId = metadata.plan_price_id;
    const customerEmail = session.customer_email;

if (!userId || !planPriceId) {
  console.error('Missing metadata: user_id or plan_price_id is undefined');
  return res.status(400).send('Missing user_id or plan_price_id in metadata.');
}

    if (!userId) {
      console.error('No user_id found in session metadata.');
      return res.status(400).send('Missing user_id in metadata.');
    }

    console.log('Checkout session completed for:', customerEmail);
    console.log('user_id from metadata:', userId);

    try {
      // Get the plan manually by priceId
      const { data: plan, error: planError } = await supabase
        .from('plan')
        .select('plan_id, duration_days') // Need this field to calculate
        .eq('stripe_price_id', planPriceId) // Need to pass price_id in metadata
        .single();
      console.log("Metadata received:", session.metadata);
      console.log("Looking for plan_price_id:", session.metadata?.plan_price_id);
      if (planError || !plan) {
        console.error('Failed to fetch plan:', planError?.message);
        return res.status(500).send('Plan not found.');
      }

      // Check if user has an active subscription
      const now = new Date();

      const { data: existingSub, error: existingError } = await supabase
        .from('subscriptions')
        .select('end_date')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.warn("⚠️ Could not check existing subscriptions:", existingError.message);
      }

      let baseDate = now;
      if (existingSub?.end_date && new Date(existingSub.end_date) > now) {
        baseDate = new Date(existingSub.end_date); // Stack on top of current end date
      }

      const startDate = now;
      const endDate = new Date(baseDate);
      endDate.setDate(endDate.getDate() + plan.duration_days); // Add 30 or 365 days

      // Insert subscription into Supabase
      if (existingSub?.end_date && new Date(existingSub.end_date) > now) {
        //  User has active sub, extend it
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            end_date: endDate,
            updated_at: new Date()
          })
          .eq('user_id', userId)
          .eq('status', 'active');
      
        if (updateError) {
          console.error('Failed to extend subscription:', updateError.message);
          return res.status(500).send('Failed to extend subscription.');
        }
      
        console.log('Existing subscription extended for user:', userId);
      } else {
        //  No active sub, insert a new one
        const { error: insertError } = await supabase.from('subscriptions').insert({
          user_id: userId,
          plan_id: plan.plan_id,
          start_date: startDate,
          end_date: endDate,
          status: 'active'
        });
      
        if (insertError) {
          console.error(' Failed to insert subscription:', insertError.message);
          return res.status(500).send('Database insert error.');
        }
      
        console.log(' New subscription inserted into Supabase for user:', userId);
      }      

      console.log('One-time subscription inserted into Supabase for user:', userId);
    } catch (err) {
      console.error('Error processing payment:', err.message);
      return res.status(500).send('Processing error.');
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;
