// routes/moderator.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// --- Middleware for Role Check ---
const checkModeratorRole = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error("Auth Error in middleware:", authError?.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }

  const { data: userData, error: dbError } = await supabase
    .from('users')
    .select('role, user_id')
    .eq('auth_id', user.id)
    .single();

  if (dbError) {
     console.error("DB Error fetching user role in middleware:", dbError?.message);
     return res.status(403).json({ message: 'Forbidden: Could not verify user profile' });
  }
   if (!userData) {
       console.log(`Forbidden: User profile not found for auth_id: ${user.id}`);
       return res.status(403).json({ message: 'Forbidden: User profile not found' });
   }

  if (userData.role !== 'moderator') {
    console.log(`Forbidden: User ${user.id} has role '${userData.role}', required 'moderator'`);
    return res.status(403).json({ message: `Forbidden: Requires moderator role` });
  }

  req.moderatorUserId = userData.user_id;
  console.log(`Moderator access granted for user_id: ${req.moderatorUserId}`);
  next();
};

router.use(checkModeratorRole); // Apply middleware

// --- Comment Management ---
// GET /comments/flagged
router.get('/comments/flagged', async (req, res) => {
  console.log("API HIT: GET /api/moderator/comments/flagged");
  try {
    const { data, error } = await supabase.from('comment').select(`comment_id, comment_text, comment_date, article_id, users ( user_id, display_name )`).eq('flagged', true).order('comment_date', { ascending: false });
    if (error) throw error;
    console.log(`Found ${data?.length || 0} flagged comments.`);
    res.json(data || []);
  } catch (err) { /* ... error handling ... */ res.status(500).json({ message: 'Failed to fetch flagged comments' });}
});
// DELETE /comments/:comment_id
router.delete('/comments/:comment_id', async (req, res) => {
  const { comment_id } = req.params;
  console.log(`API HIT: DELETE /api/moderator/comments/${comment_id}`);
  if (!comment_id) return res.status(400).json({ message: 'Comment ID is required' });
  try {
    const { error } = await supabase.from('comment').delete().eq('comment_id', comment_id);
    if (error) throw error;
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) { /* ... error handling ... */ res.status(500).json({ message: 'Failed to delete comment' });}
});


// --- Article Management ---

// *** UPDATED Route to fetch REPORTED Articles ***
router.get('/articles/reported', async (req, res) => {
    console.log("API HIT: GET /api/moderator/articles/reported - Fetching Publisher");
    try {
        // *** Select string with NO internal comments ***
        const { data, error } = await supabase
            .from('article')
            .select(`
                article_id,
                title,
                content,
                publication_date,
                status,
                flagged,
                published_by,
                categories ( name ),
                publisher:users!article_published_by_fkey ( user_id, display_name )
            `)
            .eq('flagged', true)
            .eq('status', 'published')
            .order('publication_date', { ascending: false });

        if (error) {
            console.error("Supabase error fetching reported articles (publisher):", JSON.stringify(error, null, 2));
            throw error;
        }

        console.log(`Found ${data?.length || 0} reported articles.`);
        res.json(data || []);

    } catch (err) {
        console.error('Catch block error fetching reported articles (publisher):', err.message);
        res.status(500).json({
            message: 'Failed to fetch reported articles',
            error: err.message,
            code: err.code
         });
    }
});

// DELETE Article (Works for reported articles too)
router.delete('/articles/:article_id', async (req, res) => {
    const { article_id } = req.params;
     console.log(`API HIT: DELETE /api/moderator/articles/${article_id}`);
     if (!article_id) return res.status(400).json({ message: 'Article ID is required' });
     try {
         // Cascade delete (optional, depends on DB setup)
         console.log(`Attempting cascade delete for article ${article_id}`);
         await supabase.from('news_images').delete().eq('article_id', article_id);
         await supabase.from('comment').delete().eq('article_id', article_id);
         await supabase.from('interaction').delete().eq('article_id', article_id);

         // Delete the article
         const { error } = await supabase.from('article').delete().eq('article_id', article_id);
         if (error) throw error;
         console.log(`Successfully deleted article ${article_id}`);
         res.status(200).json({ message: 'Article and associated data deleted successfully' });
     } catch (err) {
         console.error(`Error during cascade delete for article ${article_id}:`, err.message);
         res.status(500).json({ message: 'Failed to delete article' });
     }
});

// Remove or comment out old/unused article routes like /articles/pending if desired


// --- User Policy Management ---
// GET /users
router.get('/users', async (req, res) => {
    console.log("API HIT: GET /api/moderator/users");
    try {
        const { data, error } = await supabase.from('users').select('user_id, display_name, email, role, ban_status, created_at').order('created_at', { ascending: false });
        if (error) throw error;
        console.log(`Found ${data?.length || 0} users.`);
        res.json(data || []);
    } catch (err) { /* ... error handling ... */ res.status(500).json({ message: 'Failed to fetch users' });}
});
// PUT /users/:user_id/ban
router.put('/users/:user_id/ban', async (req, res) => {
    const { user_id } = req.params;
    const actingModeratorId = req.moderatorUserId;

    console.log(`API HIT: PUT /api/moderator/users/${user_id}/ban by moderator ${actingModeratorId}`);
    // ... (keep checks for user_id, self-ban, admin role) ...
     if (!user_id) return res.status(400).json({ message: 'User ID is required' });
     if (!actingModeratorId) return res.status(500).json({ message: 'Moderator ID not found in request' });
     // Optional self-ban check
     // if (user_id === actingModeratorId) return res.status(403).json({ message: 'Moderators cannot ban themselves.' });


    try {
        // Check target user details
        const { data: userToCheck, error: fetchError } = await supabase
           .from('users').select('role').eq('user_id', user_id).single();

        if (fetchError) { /* ... handle error ... */ return res.status(500).json({ message: 'Could not verify target user role' }); }
        if (!userToCheck) { return res.status(404).json({ message: 'Target user not found' }); }
        if (userToCheck.role === 'admin') { return res.status(403).json({ message: 'Cannot ban an admin user' }); }

        // *** Store current role THEN ban ***
        const originalRole = userToCheck.role; // Get the role BEFORE banning

        console.log(`Attempting to update role to 'banned' for user_id: ${user_id}, saving previous role: ${originalRole}`);
        const { error: updateError } = await supabase
            .from('users')
            .update({
                ban_status: 'hard_banned',
                ban_end_date: null,
                updated_at: new Date()
            })
            .eq('user_id', user_id);

        if (updateError) {
            // Log detailed error from previous step
            console.error(`!!! Supabase update failed for user ${user_id} !!!`);
            console.error("Supabase Error Code:", updateError.code);
            console.error("Supabase Error Message:", updateError.message);
            // ... etc ...
            throw updateError;
        }

        console.log(`Successfully banned user ${user_id} (was ${originalRole}) by moderator ${actingModeratorId}`);
        res.status(200).json({ message: 'User banned successfully' });

    } catch (err) {
        console.error(`Catch block triggered for banning user ${user_id}:`, err.message);
        res.status(500).json({ message: 'Failed to ban user' });
    }
});
// PUT /users/:user_id/unban
router.put('/users/:user_id/unban', async (req, res) => {
    const { user_id } = req.params;
    console.log(`API HIT: PUT /api/moderator/users/${user_id}/unban`);
    if (!user_id) return res.status(400).json({ message: 'User ID is required' });

    try {
        // Step 1: Find the user and their previous_role IF they are currently banned
        const { data: userToUnban, error: fetchError } = await supabase
            .from('users')
            .select('role')
            .eq('user_id', user_id)
            .eq('ban_status', 'hard_banned')   // Only target users who are currently banned
            .single();

        if (fetchError) {
            console.error(`Error fetching user ${user_id} for unban: ${fetchError.message}`);
             // If error code PGRST116, it means no rows found (user not found or not banned)
             if (fetchError.code === 'PGRST116') {
                 return res.status(404).json({ message: 'User not found or is not currently banned.' });
             }
            throw fetchError; // Throw other fetch errors
        }
         if (!userToUnban) { // Should be caught by .single() error, but safety check
             return res.status(404).json({ message: 'User not found or is not currently banned.' });
         }


        // Step 2: Determine the role to restore to
        const roleToRestore = userToUnban.previous_role || 'user'; // Use previous_role, or default to 'user' if null/empty
        console.log(`Attempting to restore role to '${roleToRestore}' for user_id: ${user_id}`);

        // Step 3: Update the user
        const { error: updateError } = await supabase
            .from('users')
            .update({
                ban_status: 'active',
                ban_end_date: null,
                updated_at: new Date()
            })
            .eq('user_id', user_id)
            .eq('ban_status', 'hard'); // Ensure we only update if still banned

        if (updateError) {
             console.error(`!!! Supabase update failed during unban for user ${user_id} !!!`);
             console.error("Supabase Error:", updateError.message);
             throw updateError;
        }

        console.log(`Successfully unbanned user ${user_id}, role set to ${roleToRestore}`);
        res.status(200).json({ message: 'User unbanned successfully' });

    } catch (err) {
        console.error(`Catch block triggered for unbanning user ${user_id}:`, err.message);
        res.status(500).json({ message: 'Failed to unban user' });
    }
});

module.exports = router;