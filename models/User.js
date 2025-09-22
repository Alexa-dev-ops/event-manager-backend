const db = require('../database');
const bcrypt = require('bcryptjs');

// Create users table
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  profilePicture TEXT DEFAULT '',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const User = {
  // Create a new user
  create: async (userData) => {
    const { name, email, password, profilePicture = '' } = userData;
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO users (name, email, password, profilePicture) VALUES (?, ?, ?, ?)`;
      
      db.run(sql, [name, email, hashedPassword, profilePicture], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, name, email, profilePicture });
        }
      });
    });
  },

  // Find user by email
  findByEmail: (email) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE email = ?';
      
      db.get(sql, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  // Find user by ID
  findById: (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, name, email, profilePicture, createdAt, updatedAt FROM users WHERE id = ?';
      
      db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  // Update user profile
  update: (id, userData) => {
    const { name, email, profilePicture } = userData;
    
    return new Promise((resolve, reject) => {
      const sql = `UPDATE users SET name = ?, email = ?, profilePicture = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
      
      db.run(sql, [name, email, profilePicture, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  },

  // Get all users (except the current user)
  findAllExcept: (currentUserId) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, name, email FROM users WHERE id != ?';
      
      db.all(sql, [currentUserId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  // Compare password
  comparePassword: async (candidatePassword, hashedPassword) => {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }
};

module.exports = User;