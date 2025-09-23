const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Better database path handling
const getDbPath = () => {
  if (process.env.NODE_ENV === 'production') {
    // For production, consider using a persistent volume if available
    // Otherwise, log a warning about data loss
    const prodPath = process.env.DATABASE_PATH || '/tmp/eventmanager.db';
    if (prodPath.includes('/tmp/')) {
      console.warn('⚠️ WARNING: Using ephemeral storage. Database will be reset on deployment!');
    }
    return prodPath;
  }
  
  // For development, ensure the directory exists
  const devPath = path.join(__dirname, 'eventmanager.db');
  const dir = path.dirname(devPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return devPath;
};

const dbPath = getDbPath();
console.log('Database path:', dbPath);

// Create database connection immediately (synchronously)
const db = new sqlite3.Database(
  dbPath, 
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, 
  (err) => {
    if (err) {
      console.error('Database connection failed:', err.message);
      process.exit(1);
    } else {
      console.log('✓ Connected to SQLite database at:', dbPath);
      initializeDatabase();
    }
  }
);

// Initialize database tables and settings
const initializeDatabase = () => {
  db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) console.error('Error enabling foreign keys:', err);
      else console.log('✓ Foreign key constraints enabled');
    });

    // Set other pragmas for better performance
    db.run('PRAGMA journal_mode = WAL', (err) => {
      if (err) console.error('Error setting WAL mode:', err);
      else console.log('✓ WAL mode enabled');
    });

    db.run('PRAGMA synchronous = NORMAL', (err) => {
      if (err) console.error('Error setting synchronous mode:', err);
      else console.log('✓ Synchronous mode set to NORMAL');
    });

    let tablesCreated = 0;
    const totalTables = 3;
    let hasError = false;

    const checkCompletion = (err, tableName) => {
      if (err) {
        console.error(`Error creating ${tableName} table:`, err);
        hasError = true;
        return;
      }
      
      console.log(`✓ ${tableName} table ready`);
      tablesCreated++;
      
      if (tablesCreated === totalTables && !hasError) {
        console.log('✓ Database initialization completed successfully');
        createIndexes();
      }
    };

    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      profilePicture TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => checkCompletion(err, 'Users'));

    // Events table
    db.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      time TIME NOT NULL,
      location TEXT NOT NULL,
      organizer_id INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizer_id) REFERENCES users (id) ON DELETE CASCADE
    )`, (err) => checkCompletion(err, 'Events'));

    // Event attendees table
    db.run(`CREATE TABLE IF NOT EXISTS event_attendees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'maybe')),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(event_id, user_id)
    )`, (err) => checkCompletion(err, 'Event_attendees'));
  });
};

// Create indexes for better performance
const createIndexes = () => {
  console.log('Creating database indexes...');
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_organizer 
          ON events (organizer_id)`, (err) => {
    if (err) console.error('Error creating events organizer index:', err);
    else console.log('✓ Events organizer index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_events_date 
          ON events (date, time)`, (err) => {
    if (err) console.error('Error creating events date index:', err);
    else console.log('✓ Events date index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_attendees_event 
          ON event_attendees (event_id)`, (err) => {
    if (err) console.error('Error creating attendees event index:', err);
    else console.log('✓ Attendees event index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_attendees_user 
          ON event_attendees (user_id)`, (err) => {
    if (err) console.error('Error creating attendees user index:', err);
    else console.log('✓ Attendees user index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email 
          ON users (email)`, (err) => {
    if (err) console.error('Error creating users email index:', err);
    else console.log('✓ Users email index created');
  });
};

// Health check function
const healthCheck = () => {
  return new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"', (err, row) => {
      if (err) {
        console.error('Database health check failed:', err);
        resolve(false);
      } else {
        console.log(`Database health check passed. Found ${row.count} tables.`);
        resolve(true);
      }
    });
  });
};

// Graceful shutdown handlers
const closeDatabase = () => {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('✓ Database connection closed.');
      }
    });
  }
};

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Gracefully shutting down database...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Gracefully shutting down database...');
  closeDatabase();
  process.exit(0);
});

// Export the database instance directly
module.exports = db;