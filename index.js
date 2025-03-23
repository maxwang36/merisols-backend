require('dotenv').config();
const express = require('express');
const cors = require('cors');


const articlesRoute = require('./routes/admin');
const usersRoute = require('./routes/users');
const aiRoute = require('./routes/ai'); // 👈 OpenAI route

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Allow all origins (temporary for testing)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is live! ✅');
});

// ✅ Routes
app.use('/api/admin', articlesRoute);
app.use('/api/users', usersRoute);
app.use('/api/ai', aiRoute); // 👈 AI summary route

// ✅ Health check
app.get('/api/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
