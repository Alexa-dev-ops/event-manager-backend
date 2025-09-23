const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log('Starting Event Manager Backend...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 5000);

// Import database first - this initializes tables
const db = require('./database');

// Import models (they now just export functions, tables created in database.js)
require('./models/User');
require('./models/Event');

// CREATE APP FIRST
const app = express();
const PORT = process.env.PORT || 5000;

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Request body keys:', Object.keys(req.body || {}));
  }
  next();
});

// CORS middleware - Allow all origins for testing
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add response time logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Import routes AFTER app is created
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const userRoutes = require('./routes/users');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ 
    message: 'Event Manager API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'Connected'
  });
});

// Test endpoint for mobile devices
app.get('/test-connection', (req, res) => {
  res.json({
    message: 'Backend is reachable from mobile device!',
    clientIp: req.ip,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    userAgent: req.get('User-Agent')
  });
});

// Database status endpoint
app.get('/api/status', (req, res) => {
  // Test database connection
  db.get('SELECT 1 as test', (err, row) => {
    if (err) {
      console.error('Database test failed:', err.message);
      res.status(500).json({
        status: 'error',
        database: 'disconnected',
        error: err.message
      });
    } else {
      res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler (must be last)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  console.error('Stack trace:', err.stack);
  
  res.status(err.status || 500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server started successfully!');
  console.log(`Server running on port ${PORT}`);
  console.log(`Available at: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Auth test: http://localhost:${PORT}/api/auth/test`);
  console.log(`Mobile test: http://localhost:${PORT}/test-connection`);
  console.log('Startup time:', new Date().toISOString());
});