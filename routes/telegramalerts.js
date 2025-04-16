const express = require('express');
const router = express.Router();
require('dotenv').config();

// Import node-fetch dynamically for ESM compatibility
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

router.post('/high-priority-alert', async (req, res) => {
  console.log('🔥 Telegram route HIT');
  console.log('Payload received:', req.body);
  console.log('📢 TELEGRAM_BOT:', process.env.TELEGRAM_BOT?.substring(0, 15) + '...');
  console.log('📢 TELEGRAM_GROUPID:', process.env.TELEGRAM_GROUPID);

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
    // ✅ Send text message
    const textResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_GROUPID,
        text: message,
        // parse_mode: 'Markdown' // ❗Commented out for now to prevent markdown errors
      })
    });

    const rawText = await textResponse.text();
    console.log('📨 Telegram sendMessage raw response:', rawText);

    let parsedTextResponse;
    try {
      parsedTextResponse = JSON.parse(rawText);
    } catch (jsonErr) {
      throw new Error(`Response is not valid JSON: ${jsonErr.message}`);
    }

    if (!parsedTextResponse.ok) {
      throw new Error(`Telegram sendMessage failed: ${parsedTextResponse.description}`);
    }

    // ✅ Optionally send attachment if available
    if (attachment) {
      const photoResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_GROUPID,
          photo: attachment
        })
      });

      const rawPhoto = await photoResponse.text();
      console.log('📷 Telegram sendPhoto raw response:', rawPhoto);

      const photoResult = JSON.parse(rawPhoto);
      if (!photoResult.ok) {
        throw new Error(`Telegram sendPhoto failed: ${photoResult.description}`);
      }
    }

    return res.status(200).json({ success: true, message: 'Telegram alert sent successfully' });

  } catch (error) {
    console.error('❌ Telegram alert failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Telegram alert failed',
      error: error.message
    });
  }
});

module.exports = router;
