require('dotenv').config();
const express = require('express');
const cors = require('cors');
const articlesRoute = require('./routes/articles');
const usersRoute = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use('/api/articles', articlesRoute);
app.use('/api/users', usersRoute);

app.get('/api/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
