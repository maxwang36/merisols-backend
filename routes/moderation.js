const express = require('express');
const fetch = require('node-fetch'); // or axios
const router = express.Router();

router.post('/moderate-article', async (req, res) => {
  const { text, imageUrl } = req.body;

  if (!text || !imageUrl) {
    return res.status(400).json({ error: 'Missing text or imageUrl' });
  }

  try {
    const response = await fetch('https://maxwang36-merisols-clip-check.hf.space/clip-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, image_url: imageUrl }),
    });

    const data = await response.json();
    res.json({ similarity_score: data.similarity_score, verdict: data.verdict });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Moderation API failed' });
  }
});

module.exports = router;
