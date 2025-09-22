const db = require('../database');

// Create events table
db.run(`CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  startTime DATETIME NOT NULL,
  endTime DATETIME NOT NULL,
  location TEXT NOT NULL,
  creatorId INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creatorId) REFERENCES users (id) ON DELETE CASCADE
)`);

// Create event_attendees table
db.run(`CREATE TABLE IF NOT EXISTS event_attendees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventId) REFERENCES events (id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(eventId, userId)
)`);

const Event = {
  // Create a new event
  create: (eventData) => {
    const { title, description, startTime, endTime, location, creatorId } = eventData;
    
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO events (title, description, startTime, endTime, location, creatorId) VALUES (?, ?, ?, ?, ?, ?)`;
      
      db.run(sql, [title, description, startTime, endTime, location, creatorId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, title, description, startTime, endTime, location, creatorId });
        }
      });
    });
  },

  // Add attendees to an event
  addAttendees: (eventId, attendees) => {
    if (!attendees || attendees.length === 0) {
      return Promise.resolve([]);
    }
    
    const placeholders = attendees.map(() => '(?, ?)').join(',');
    const values = attendees.flatMap(userId => [eventId, userId]);
    
    return new Promise((resolve, reject) => {
      const sql = `INSERT OR IGNORE INTO event_attendees (eventId, userId) VALUES ${placeholders}`;
      
      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  },

  // Get all events for a user
  findByUser: (userId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          e.*,
          u.name as creatorName,
          u.email as creatorEmail,
          COUNT(ea.userId) as attendeeCount
        FROM events e
        LEFT JOIN users u ON e.creatorId = u.id
        LEFT JOIN event_attendees ea ON e.id = ea.eventId
        WHERE e.creatorId = ? OR ea.userId = ?
        GROUP BY e.id
        ORDER BY e.startTime ASC
      `;
      
      db.all(sql, [userId, userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  // Find event by ID with details
  findByIdWithDetails: (id) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          e.*,
          u.name as creatorName,
          u.email as creatorEmail
        FROM events e
        LEFT JOIN users u ON e.creatorId = u.id
        WHERE e.id = ?
      `;
      
      db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  // Get attendees for an event
  getAttendees: (eventId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT u.id, u.name, u.email 
        FROM event_attendees ea 
        JOIN users u ON ea.userId = u.id 
        WHERE ea.eventId = ?
      `;
      
      db.all(sql, [eventId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  // Update an event
  update: (id, eventData) => {
    const { title, description, startTime, endTime, location } = eventData;
    
    return new Promise((resolve, reject) => {
      const sql = `UPDATE events SET title = ?, description = ?, startTime = ?, endTime = ?, location = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
      
      db.run(sql, [title, description, startTime, endTime, location, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  },

  // Delete an event
  delete: (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM events WHERE id = ?';
      
      db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  },

  // Remove all attendees from an event
  clearAttendees: (eventId) => {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM event_attendees WHERE eventId = ?';
      
      db.run(sql, [eventId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  },

  // Check if user is creator of event
  isCreator: (eventId, userId) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id FROM events WHERE id = ? AND creatorId = ?';
      
      db.get(sql, [eventId, userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }
};

module.exports = Event;