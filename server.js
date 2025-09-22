const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import database and models
const db = require('./database');
require('./models/User');
require('./models/Event');

// Import routes
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - Allow all origins for testing
app.use(cors({
  origin: '*', // Allow all origins for testing
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Event Manager API is running!' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoint for mobile devices
app.get('/test-connection', (req, res) => {
  res.json({ 
    message: 'Backend is reachable from mobile device!',
    clientIp: req.ip,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available on your computer: http://localhost:${PORT}`);
});