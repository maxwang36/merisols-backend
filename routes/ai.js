const express = require('express');
const router = express.Router();
const openai = require('../lib/openai');

router.post('/generate-summary', async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ success: false, message: 'Missing content' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful AI that summarizes news articles.' },
        { role: 'user', content: `Summarize this article:\n\n${content}` },
      ],
    });

    const summary = response.choices[0].message.content;
    res.json({ success: true, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'OpenAI error', error: err.message });
  }
});

module.exports = router;
