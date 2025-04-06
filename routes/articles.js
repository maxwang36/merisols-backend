// routes/articles.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// --- Middleware to check if user is logged in ---
const checkUserLoggedIn = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Allow proceeding if no token, but mark req.user as null
    // Routes that REQUIRE login will check req.user
    req.user = null;
    return next();
    // If endpoint STRICTLY requires login, use:
    // return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    // Token provided but invalid
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
  // Attach user info
  req.user = user;
  next();
};

// --- Endpoint for Reporting/Flagging an Article ---
router.put('/:article_id/report', checkUserLoggedIn, async (req, res) => {
    const { article_id } = req.params;

    // Ensure user is logged in for this specific action
    if (!req.user) {
         return res.status(401).json({ message: 'Unauthorized: You must be logged in to report an article.' });
     }

    console.log(`API HIT: PUT /api/articles/${article_id}/report by user ${req.user.id}`);

    if (!article_id) {
        return res.status(400).json({ message: 'Article ID is required' });
    }

    try {
        // Update the article's flagged status to true
        const { data, error } = await supabase
            .from('article')
            .update({ flagged: true }) // Set the new flagged column to true
            .eq('article_id', article_id)
            .eq('status', 'published') // Only allow flagging published articles
            .select('article_id');

        if (error) {
            console.error(`Supabase error reporting article ${article_id}:`, error.message);
            throw error;
        }

        if (!data || data.length === 0) {
             const { data: checkArticle } = await supabase.from('article').select('article_id').eq('article_id', article_id).maybeSingle();
             if (!checkArticle) {
                  return res.status(404).json({ message: 'Article not found.' });
             } else {
                  return res.status(400).json({ message: 'Article could not be reported (it might not be published).' });
             }
        }

        console.log(`Successfully reported article ${article_id}`);
        res.status(200).json({ message: 'Article reported successfully. A moderator will review it.' });

    } catch (err) {
        console.error(`Error reporting article ${article_id}:`, err.message);
        res.status(500).json({ message: 'Failed to report article' });
    }
});

module.exports = router;