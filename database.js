const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use /tmp directory for Render (ephemeral but works)
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/eventmanager.db' 
  : path.join(__dirname, 'eventmanager.db');

console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Initialize tables immediately
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    profilePicture TEXT DEFAULT '',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('✓ Users table ready');
  });
});

module.exports = db;