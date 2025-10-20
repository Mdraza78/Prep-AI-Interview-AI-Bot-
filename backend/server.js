const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const userRoutes = require('./routes/userRoutes');

const app = express();

// FIX: Update CORS for production
app.use(cors({
  origin: [
    'https://prep-ai-interview-ai-bot.vercel.app', // Your Vercel URL
    'http://localhost:5173' // Vite dev server
  ],
  credentials: true
}));

app.use(express.json());

// FIX: Add proper MongoDB connection options
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/user', userRoutes);

// Add a test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));