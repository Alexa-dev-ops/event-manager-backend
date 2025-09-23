// routes/users.js - CREATE THIS FILE IN YOUR BACKEND
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Middleware to verify token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token invalid' });
  }
};

// Get all users (for attendee dropdown)
router.get('/', auth, async (req, res) => {
  try {
    console.log('Getting all users for user:', req.userId);
    const users = await User.findAllExcept(req.userId);
    console.log(`Found ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    console.log('Getting profile for user:', req.userId);
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    console.log('Updating profile for user:', req.userId, req.body);
    const { name, email, profilePicture } = req.body;
    const result = await User.update(req.userId, { name, email, profilePicture });
    if (result.changes === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = await User.findById(req.userId);
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;