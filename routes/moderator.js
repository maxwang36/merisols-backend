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

// --- Endpoint to unflag a comment ---
// PUT /api/moderator/comments/:comment_id/unflag
router.put('/comments/:comment_id/unflag', async (req, res) => {
  const { comment_id } = req.params;
  console.log(`API HIT: PUT /api/moderator/comments/${comment_id}/unflag`);

  if (!comment_id) {
    return res.status(400).json({ message: 'Comment ID is required' });
  }

  try {
    const { data, error } = await supabase
      .from('comment')
      .update({ flagged: false }) // Set flagged to false
      .eq('comment_id', comment_id)
      .select(); // Optionally select the updated comment to return it

    if (error) {
      console.error(`Supabase error unflagging comment ${comment_id}:`, error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Comment not found or already unflagged.' });
    }

    console.log(`Successfully unflagged comment ${comment_id}`);
    res.status(200).json({ message: 'Comment unflagged successfully', comment: data[0] });
  } catch (err) {
    console.error(`Error unflagging comment ${comment_id}:`, err.message);
    res.status(500).json({ message: 'Failed to unflag comment', error: err.message });
  }
});
// --- Article Management ---

// *** Route to fetch REPORTED Articles ***
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
         // Cascade delete
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

// --- Endpoint to unflag an article ---
// PUT /api/moderator/articles/:article_id/unflag
router.put('/articles/:article_id/unflag', async (req, res) => {
  const { article_id } = req.params;
  console.log(`API HIT: PUT /api/moderator/articles/${article_id}/unflag`);

  if (!article_id) {
    return res.status(400).json({ message: 'Article ID is required' });
  }

  try {
    const { data, error } = await supabase
      .from('article')
      .update({ flagged: false }) // Set flagged to false
      .eq('article_id', article_id)
      .select(); // Optionally select the updated article to return it

    if (error) {
      console.error(`Supabase error unflagging article ${article_id}:`, error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Article not found or already unflagged.' });
    }

    console.log(`Successfully unflagged article ${article_id}`);
    res.status(200).json({ message: 'Article unflagged successfully', article: data[0] });
  } catch (err) {
    console.error(`Error unflagging article ${article_id}:`, err.message);
    res.status(500).json({ message: 'Failed to unflag article', error: err.message });
  }
});

// --- User Policy Management ---
// GET /users
router.get('/users', async (req, res) => {
    console.log("API HIT: GET /api/moderator/users (with flag counts)");
  
    try {
      const { data, error } = await supabase
        .rpc('get_users_with_flags'); // <-- Use RPC to call the SQL function
  
      if (error) throw error;
  
      console.log(`Fetched ${data.length} users with flag stats`);
      res.json(data);
    } catch (err) {
      console.error("Error fetching flagged user data:", err.message);
      res.status(500).json({ message: 'Failed to fetch users', error: err.message });
    }
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
                ban_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
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

        // Send email notification to user
        try {
          const { data: userProfile } = await supabase
            .from('users')
            .select('display_name, email')
            .eq('user_id', user_id)
            .single();
        
          await fetch('https://merisols-backend.onrender.com/api/email/send-ban-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'ban',
              recipientEmail: 'merisolstimes@gmail.com',
              recipientName: userProfile.display_name
            })
          });
          console.log(`Ban email sent to ${userProfile.email}`);
        } catch (emailErr) {
          console.warn('Ban email notification failed:', emailErr.message);
        }
        
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
    const { data: userToUnban, error: fetchError } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .eq('ban_status', 'hard_banned')
      .single();

    if (fetchError) {
      console.error(`Error fetching user ${user_id} for unban: ${fetchError.message}`);
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ message: 'User not found or is not currently banned.' });
      }
      throw fetchError;
    }
    if (!userToUnban) {
      return res.status(404).json({ message: 'User not found or is not currently banned.' });
    }

    const roleToRestore = userToUnban.previous_role || 'user';
    console.log(`Attempting to restore role to '${roleToRestore}' for user_id: ${user_id}`);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        ban_status: 'active',
        ban_end_date: null,
        updated_at: new Date()
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error(`!!! Supabase update failed during unban for user ${user_id} !!!`);
      console.error("Supabase Error:", updateError.message);
      throw updateError;
    }

    console.log(`Successfully unbanned user ${user_id}, role set to ${roleToRestore}`);

    // Send unban email
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('display_name, email')
        .eq('user_id', user_id)
        .single();

      await fetch('https://merisols-backend.onrender.com/api/email/send-ban-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'unban',
          recipientEmail: 'merisolstimes@gmail.com',
          recipientName: userProfile.display_name
        })
      });
      console.log(`Unban email sent to ${userProfile.email}`);
    } catch (emailErr) {
      console.warn('Unban email notification failed:', emailErr.message);
    }

    res.status(200).json({ message: 'User unbanned successfully' });

  } catch (err) {
    console.error(`Catch block triggered for unbanning user ${user_id}:`, err.message);
    res.status(500).json({ message: 'Failed to unban user' });
  }
});

// PUT /users/:user_id/soft-ban
router.put('/users/:user_id/soft-ban', async (req, res) => {
    const { user_id } = req.params;
  
    try {
      const { data: userToCheck, error: fetchError } = await supabase
        .from('users')
        .select('role')
        .eq('user_id', user_id)
        .single();
  
      if (fetchError || !userToCheck) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      if (userToCheck.role !== 'user' && userToCheck.role !== 'journalist') {
        return res.status(403).json({ message: 'Only users and journalists can be soft banned' });
      }
  
      const { error: updateError } = await supabase
        .from('users')
        .update({
            ban_status: 'soft_banned',
            ban_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            updated_at: new Date()
        })
        .eq('user_id', user_id);
  
      if (updateError) {
        throw updateError;
      }
  
          // Send soft ban email
      try {
        const { data: userProfile } = await supabase
          .from('users')
          .select('display_name, email')
          .eq('user_id', user_id)
          .single();

        await fetch('https://merisols-backend.onrender.com/api/email/send-ban-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'softban',
            recipientEmail: 'merisolstimes@gmail.com',
            recipientName: userProfile.display_name
          })
        });
        console.log(`Soft ban email sent to ${userProfile.email}`);
      } catch (emailErr) {
        console.warn('Soft ban email notification failed:', emailErr.message);
      }

      res.status(200).json({ message: 'User soft banned successfully' });
  
    } catch (err) {
      console.error('Soft ban error:', err.message);
      res.status(500).json({ message: 'Soft ban failed', error: err.message });
    }
  });
  
  router.put('/users/:user_id/unsoft-ban', async (req, res) => {
    const { user_id } = req.params;
  
    try {
      const { error } = await supabase
        .from('users')
        .update({ ban_status: 'active', ban_end_date: null, updated_at: new Date() })
        .eq('user_id', user_id);
  
      if (error) throw error;

            // Send unsoft ban email
      try {
        const { data: userProfile } = await supabase
          .from('users')
          .select('display_name, email')
          .eq('user_id', user_id)
          .single();

        await fetch('https://merisols-backend.onrender.com/api/email/send-ban-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'unsoftban',
            recipientEmail: 'merisolstimes@gmail.com',
            recipientName: userProfile.display_name
          })
        });
        console.log(`Unsoft ban email sent to ${userProfile.email}`);
      } catch (emailErr) {
        console.warn('Unsoft ban email notification failed:', emailErr.message);
      }

  
      res.status(200).json({ message: 'Soft ban lifted successfully' });
    } catch (err) {
      console.error('Unsoft ban error:', err.message);
      res.status(500).json({ message: 'Failed to lift soft ban', error: err.message });
    }
  });

module.exports = router;