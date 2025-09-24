// routes/users.js - REPLACE YOUR EXISTING FILE
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Middleware to verify token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      console.log('No token provided in request');
      return res.status(401).json({ message: 'No token provided' });
    }
    
    console.log('Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
    console.log('Token verified for user:', req.userId);
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ message: 'Token invalid' });
  }
};

// Get all users (for attendee dropdown)
router.get('/', auth, async (req, res) => {
  try {
    console.log('Getting all users except user:', req.userId);
    const users = await User.findAllExcept(req.userId);
    console.log(`Found ${users.length} users:`, users.map(u => u.name));
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
    console.log('Profile retrieved for user:', user.name);
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update current user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    console.log('Updating profile for user:', req.userId, { name, email });
    
    // Validate input
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    
    if (name.trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters long' });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    
    // Check if email is already taken by another user
    const existingUser = await User.findByEmail(email.trim());
    if (existingUser && existingUser.id !== req.userId) {
      return res.status(400).json({ message: 'Email is already registered to another account' });
    }
    
    // Update user profile
    const result = await User.update(req.userId, {
      name: name.trim(),
      email: email.trim(),
      profilePicture: '' // Keep existing or empty for now
    });
    
    if (result.changes === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return updated user data
    const updatedUser = await User.findById(req.userId);
    console.log('Profile updated successfully for user:', updatedUser.name);
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;