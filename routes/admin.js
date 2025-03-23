const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { nanoid } = require('nanoid');

router.post('/create-user', async (req, res) => {
  const { email, password, name, role = 'user' } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  // Step 1: Create Supabase Auth user (admin API)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });

  if (error) {
    return res.status(500).json({ success: false, message: 'Auth create failed', error: error.message });
  }

  const authUser = data.user;

  // Step 2: Insert into your users table
  const userId = nanoid(10);

  const { error: insertError } = await supabase.from('users').insert([
    {
      user_id: userId,
      auth_id: authUser.id,
      email,
      display_name: name,
      role,
      created_at: new Date(),
    },
  ]);

  if (insertError) {
    return res.status(500).json({ success: false, message: 'User table insert failed', error: insertError.message });
  }

  return res.status(201).json({ success: true, user: authUser });
});

module.exports = router;
