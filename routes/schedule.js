// routes/schedule.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post('/schedule-run', async (req, res) => {
  const now = new Date().toISOString();

  try {
    const { data: articlesToPublish, error: fetchError } = await supabase
      .from('article')
      .select('article_id')
      .eq('status', 'scheduled')
      .lte('publication_date', now);

    if (fetchError) {
      console.error('❌ Error fetching scheduled articles:', fetchError.message);
      return res.status(500).json({ message: 'Error fetching scheduled articles' });
    }

    if (!articlesToPublish.length) {
      return res.status(200).json({ message: '✅ No articles ready to publish' });
    }

    const articleIds = articlesToPublish.map(a => a.article_id);

    const { error: updateError } = await supabase
      .from('article')
      .update({ status: 'published' })
      .in('article_id', articleIds);

    if (updateError) {
      console.error('❌ Failed to publish articles:', updateError.message);
      return res.status(500).json({ message: 'Failed to publish articles' });
    }

    return res.status(200).json({ message: `✅ Published ${articleIds.length} article(s)` });
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
