require('dotenv').config();
const express = require('express');
const cors = require('cors');


const articlesRoute = require('./routes/admin');
const usersRoute = require('./routes/users');
const interactionRoutes = require('./routes/interactions');
const commentRoutes = require('./routes/comments');
const aiRoute = require('./routes/ai'); // 👈 OpenAI route
const emailRoute = require('./routes/email'); // New email route
const scheduleRoutes = require('./routes/schedule');
const moderatorRoutes = require('./routes/moderator');
const generalArticleRoutes = require('./routes/articles')

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
app.use('/api/interactions', interactionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/ai', aiRoute); // 👈 AI summary route
app.use('/api/email', emailRoute); // Add new email route
app.use('/api', scheduleRoutes);
app.use('/api/moderator', moderatorRoutes);
app.use('/api/articles', generalArticleRoutes);


// ✅ Health check
app.get('/api/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
