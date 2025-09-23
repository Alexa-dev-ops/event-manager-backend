const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Add this at the top of your routes/auth.js file:
router.get('/test', (req, res) => {
  res.json({
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Add test users route for creating dummy users
router.post('/create-test-users', async (req, res) => {
  try {
    console.log('Creating test users...');
    
    const testUsers = [
      { name: 'John Doe', email: 'john@test.com', password: 'test123' },
      { name: 'Jane Smith', email: 'jane@test.com', password: 'test123' },
      { name: 'Bob Johnson', email: 'bob@test.com', password: 'test123' },
      { name: 'Alice Brown', email: 'alice@test.com', password: 'test123' },
      { name: 'Charlie Wilson', email: 'charlie@test.com', password: 'test123' }
    ];

    let created = 0;
    let skipped = 0;

    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findByEmail(userData.email);
        if (existingUser) {
          console.log(`User ${userData.email} already exists - skipping`);
          skipped++;
          continue;
        }

        await User.create(userData);
        console.log(`Created test user: ${userData.name} (${userData.email})`);
        created++;
      } catch (err) {
        console.log(`Failed to create user ${userData.email}:`, err.message);
      }
    }

    res.json({ 
      message: 'Test users creation completed',
      created: created,
      skipped: skipped,
      total: testUsers.length
    });
  } catch (error) {
    console.error('Create test users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    console.log('Registration attempt:', { name, email });
    
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create user
    const user = await User.create({ name, email, password });
    console.log('User created successfully:', user.id);
    
    // Generate token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt for:', email);
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await User.comparePassword(password, user.password);
    if (!isMatch) {
      console.log('Invalid password for:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    console.log('Login successful for:', email);
    
    // Generate token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;