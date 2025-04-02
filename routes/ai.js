const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const router = express.Router();

router.post('/summarize', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    const response = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-cnn', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error });
    }

    res.json({ summary: data[0]?.summary_text || 'No summary returned' });
  } catch (err) {
    console.error('Summarization error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
