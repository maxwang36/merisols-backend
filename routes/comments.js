const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST /api/comments
router.post('/', async (req, res) => {
  const { article_id, auth_id, content } = req.body;

  if (!article_id || !auth_id || !content) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Get user_id from auth_id
  const { data: userData, error: userErr } = await supabase
    .from('users')
    .select('user_id')
    .eq('auth_id', auth_id)
    .single();

  if (userErr || !userData) {
    return res.status(400).json({ message: 'Invalid user' });
  }

  // ✅ Do NOT insert comment_id manually
  const { error: insertErr } = await supabase.from('comment').insert([
    {
      article_id,
      user_id: userData.user_id,
      comment_text: content,
      comment_date: new Date(),
      flagged: false,
    },
  ]);

  if (insertErr) {
    console.error('[Comment Insert] Error:', insertErr);
    return res.status(500).json({ message: 'Failed to post comment' });
  }

  return res.status(201).json({ message: 'Comment posted successfully' });
});

// ✅ NEW: GET /api/comments/:article_id
router.get('/:article_id', async (req, res) => {
    const { article_id } = req.params;
  
    const { data, error } = await supabase
      .from('comment')
      .select(`
        comment_text,
        comment_date,
        users ( display_name )
      `)
      .eq('article_id', article_id)
      .eq('flagged', false)
      .order('comment_date', { ascending: false });
  
    if (error) {
      console.error('[Fetch Comments] Error:', error.message);
      return res.status(500).json({ message: 'Failed to fetch comments', error });
    }
  
    return res.status(200).json(data);
  });

module.exports = router;
