require('dotenv').config();
const express = require('express');
const cors = require('cors');
const articlesRoute = require('./routes/articles');
const usersRoute = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/articles', articlesRoute); // optional
app.use('/api/users', usersRoute);       // ✅ user test route

app.get('/api/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
