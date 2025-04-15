const express = require('express');
const router = express.Router();
require('dotenv').config();

router.post('/high-priority-alert', async (req, res) => {
  console.log('🔥 Telegram route HIT');
  console.log('Payload received:', req.body);

  const { userId, username, title, category, priority, timeSent, attachment, content } = req.body;

  if (!userId || !title || !category || !timeSent || !username) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (parseInt(priority) !== 1) {
    return res.status(200).json({ success: false, message: 'Priority is not high — no alert sent.' });
  }

  // Limit content to first 100 words
  const contentPreview = content?.split(/\s+/).slice(0, 100).join(' ') + (content?.split(/\s+/).length > 100 ? '...' : '');

  const message =
`---- User Article Submission ----

User ID: ${userId}
Username: ${username}
Time Sent: ${new Date(timeSent).toLocaleString()}
Priority: High
Category: ${category}
Title: ${title}


Content:
${contentPreview}`;

  try {
    // First send text message
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_GROUPID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    // Then send the image if attachment exists
    if (attachment) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_GROUPID,
          photo: attachment
        })
      });
    }

    return res.status(200).json({ success: true, message: 'Telegram alert sent successfully' });
  } catch (error) {
    console.error('❌ Telegram alert failed:', error);
    return res.status(500).json({ success: false, message: 'Telegram alert failed', error: error.message });
  }
});

module.exports = router;
