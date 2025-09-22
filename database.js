// database.js - REPLACE YOUR CURRENT FILE
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use /tmp directory for Render (ephemeral but works)
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/eventmanager.db' 
  : path.join(__dirname, 'eventmanager.db');

console.log('Database path:', dbPath);
console.log('Environment:', process.env.NODE_ENV);

// Create database connection
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Enable foreign keys and WAL mode for better performance
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA temp_store = memory');
  db.run('PRAGMA mmap_size = 268435456'); // 256MB
});

// Initialize database tables
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
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
        if (err) {
          console.error('Error creating users table:', err);
          reject(err);
        } else {
          console.log('✓ Users table ready');
        }
      });

      // Events table
      db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        location TEXT NOT NULL,
        organizer_id INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organizer_id) REFERENCES users (id)
      )`, (err) => {
        if (err) {
          console.error('Error creating events table:', err);
          reject(err);
        } else {
          console.log('✓ Events table ready');
        }
      });

      // Event attendees table
      db.run(`CREATE TABLE IF NOT EXISTS event_attendees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(event_id, user_id)
      )`, (err) => {
        if (err) {
          console.error('Error creating event_attendees table:', err);
          reject(err);
        } else {
          console.log('✓ Event attendees table ready');
          resolve();
        }
      });
    });
  });
};

// Initialize tables immediately
initializeDatabase().catch(console.error);

// Handle database errors
db.on('error', (err) => {
  console.error('Database error:', err.message);
});

// Test database connection
db.get('SELECT 1', (err, row) => {
  if (err) {
    console.error('Database connection test failed:', err.message);
  } else {
    console.log('✓ Database connection test passed');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database connection...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    else console.log('Database connection closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Closing database connection...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    else console.log('Database connection closed.');
    process.exit(0);
  });
});

module.exports = db;