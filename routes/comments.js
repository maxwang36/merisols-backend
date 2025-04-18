// routes/comments.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js'); // Assuming this is how you import
const supabase = require('../lib/supabase'); // Use your existing client setup

// --- POST /api/comments ---
// (Your existing code for posting new comments - updated with soft ban check)
router.post('/', async (req, res) => {
    const { article_id, auth_id, content } = req.body;

    if (!article_id || !auth_id || !content) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get user_id and ban_status from auth_id
    const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('user_id, ban_status')
        .eq('auth_id', auth_id)
        .single();

    if (userErr || !userData) {
        // Log the error for debugging
        console.error(`Error fetching user_id for auth_id ${auth_id}:`, userErr?.message);
        return res.status(400).json({ message: 'Invalid user' });
    }

    if (userData.ban_status === 'soft_banned') {
        return res.status(403).json({ message: 'You are currently restricted from commenting.' });
    }

    // Insert comment
    const { error: insertErr } = await supabase.from('comment').insert([
        {
            article_id,
            user_id: userData.user_id,
            comment_text: content,
            comment_date: new Date(),
            flagged: false, // Default flagged to false
        },
    ]);

    if (insertErr) {
        console.error('[Comment Insert] Error:', insertErr);
        return res.status(500).json({ message: 'Failed to post comment' });
    }

    return res.status(201).json({ message: 'Comment posted successfully' });
});


// --- GET /api/comments/:article_id ---
// (Your existing code for fetching comments for an article - Updated to include comment_id)
router.get('/:article_id', async (req, res) => {
    const { article_id } = req.params;
    if (!article_id) {
        return res.status(400).json({ message: 'Article ID is required' });
    }

    try {
        const { data, error } = await supabase
            .from('comment')
            .select(`
                comment_id,
                comment_text,
                comment_date,
                flagged,
                users ( user_id, display_name )
            `)
            .eq('article_id', article_id)
            .order('comment_date', { ascending: false });

        if (error) {
            console.error('[Fetch Comments] Error:', error.message);
            throw error; // Throw error to be caught by catch block
        }

        res.status(200).json(data || []); // Return empty array if no data

    } catch (err) {
        // Catch errors from the query or other issues
        res.status(500).json({ message: 'Failed to fetch comments', error: err.message });
    }
});

// --- *** NEW *** PUT /api/comments/:comment_id/flag ---
// Endpoint to mark a comment as flagged
router.put('/:comment_id/flag', async (req, res) => {
    const { comment_id } = req.params;

    if (!comment_id) {
        return res.status(400).json({ message: 'Comment ID is required' });
    }

    try {
        console.log(`Attempting to flag comment ${comment_id}`);
        const { data, error } = await supabase
            .from('comment')
            .update({ flagged: true }) // Set the flagged column to true
            .eq('comment_id', comment_id) // For the specific comment
            .select(); // Ask for the updated record back

        if (error) {
            console.error(`Supabase error flagging comment ${comment_id}:`, error.message);
            throw error;
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        console.log(`Successfully flagged comment ${comment_id}`);
        res.status(200).json({ message: 'Comment flagged successfully' });

    } catch (err) {
        console.error(`Error flagging comment ${comment_id}:`, err.message);
        res.status(500).json({ message: 'Failed to flag comment' });
    }
});


module.exports = router; // Make sure this is at the end
