const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Record a view
router.post('/view', async (req, res) => {
    const { article_id, auth_id, device_id } = req.body;
  
    if (!article_id) {
      return res.status(400).json({ message: 'Missing article_id' });
    }
  
    let user_id = null;
  
    if (auth_id) {
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('user_id')
        .eq('auth_id', auth_id)
        .single();
  
      if (!userErr && userData) {
        user_id = userData.user_id;
      }
    }
  
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
    let viewQuery = supabase
      .from('interaction')
      .select('interaction_id', { count: 'exact', head: true }) // 👈 efficient dedup check
      .eq('article_id', article_id)
      .eq('interaction_type', 'view')
      .gte('interaction_date', tenMinutesAgo.toISOString())
      .lte('interaction_date', now.toISOString());
  
    if (user_id) {
      viewQuery = viewQuery.eq('user_id', user_id);
    } else if (device_id) {
      viewQuery = viewQuery.eq('device_id', device_id);
    } else {
      return res.status(400).json({ message: 'Missing user_id or device_id' });
    }
  
    const { count, error: checkError } = await viewQuery;
  
    if (checkError) {
      console.error('[Deduplication Check] Error:', checkError.message);
      return res.status(500).json({ message: 'Failed to check for duplicate views' });
    }
  
    if (count && count > 0) {
      return res.status(200).json({ message: 'View already recorded recently. Skipping.' });
    }
  
    // ✅ Insert view
    const { error: insertError } = await supabase.from('interaction').insert([
      {
        article_id,
        user_id: user_id || null,
        device_id: device_id || null,
        interaction_type: 'view',
        interaction_date: now,
      }
    ]);
  
    if (insertError) {
      console.error('[Insert View] Error:', insertError.message);
      return res.status(500).json({ message: 'Failed to record view' });
    }
  
    return res.status(201).json({ message: 'View recorded successfully' });
  });
  

// Get article stats
router.get('/:article_id/stats', async (req, res) => {
  const { article_id } = req.params;

  const { data: views, error: viewError } = await supabase
    .from('interaction')
    .select('interaction_id')
    .eq('article_id', article_id)
    .eq('interaction_type', 'view');

  const { data: comments, error: commentError } = await supabase
    .from('comment')
    .select('comment_id')
    .eq('article_id', article_id);

  if (viewError || commentError) {
    return res.status(500).json({ message: 'Error getting stats' });
  }

  res.status(200).json({
    total_views: views.length,
    total_comments: comments.length,
  });
});

module.exports = router;
