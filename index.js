require('dotenv').config();
const express = require('express');
const cors = require('cors');



const articlesRoute = require('./routes/admin');
const usersRoute = require('./routes/users');
const interactionRoutes = require('./routes/interactions');
const commentRoutes = require('./routes/comments');
const aiRoute = require('./routes/ai'); //  OpenAI route
const emailRoute = require('./routes/email'); // New email route
const scheduleRoutes = require('./routes/schedule');
const moderatorRoutes = require('./routes/moderator');
const generalArticleRoutes = require('./routes/articles')
const stripeRoute = require('./routes/stripe')
const stripeWebhook = require('./routes/stripeWebhook');
const moderationRoutes = require("./routes/moderation");
const telegramAlertRoute = require('./routes/telegramalerts');
const settingsRoute = require('./routes/settings'); 

const app = express();
const PORT = process.env.PORT || 3001;

//  Allow all origins (temporary for testing)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Stripe webhook route - needs raw body middleware and must come FIRST
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/stripe/webhook', stripeWebhook);

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is live!');
});

//  Routes
app.use('/api/admin', articlesRoute);
app.use('/api/users', usersRoute);
app.use('/api/interactions', interactionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/ai', aiRoute); //  AI summary route
app.use('/api/email', emailRoute); // Add new email route
app.use('/api', scheduleRoutes);
app.use('/api/moderator', moderatorRoutes);
app.use('/api/articles', generalArticleRoutes);
app.use('/api/stripe', stripeRoute);
app.use("/api", moderationRoutes);
app.use('/api/telegram', telegramAlertRoute);
app.use('/api/settings', settingsRoute);



//  Health check
app.get('/api/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
