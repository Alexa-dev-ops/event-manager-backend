// routes/events.js - REPLACE YOUR EXISTING FILE
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
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
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Token invalid' });
  }
};

// Get all events for the current user
router.get('/', auth, async (req, res) => {
  try {
    console.log('Getting events for user:', req.userId);
    
    const sql = `
      SELECT e.*, u.name as organizer_name, u.email as organizer_email,
             COUNT(ea.id) as attendee_count
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.id
      LEFT JOIN event_attendees ea ON e.id = ea.event_id
      WHERE e.organizer_id = ? OR e.id IN (
        SELECT event_id FROM event_attendees WHERE user_id = ?
      )
      GROUP BY e.id
      ORDER BY e.date, e.time
    `;
    
    db.all(sql, [req.userId, req.userId], (err, rows) => {
      if (err) {
        console.error('Get events error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
      } else {
        console.log(`Found ${rows.length} events`);
        res.json(rows || []);
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get event by ID with attendees
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('Getting event details for:', req.params.id);
    
    const eventSql = `
      SELECT e.*, u.name as organizer_name, u.email as organizer_email
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.id
      WHERE e.id = ?
    `;
    
    const attendeesSql = `
      SELECT u.id, u.name, u.email
      FROM event_attendees ea
      JOIN users u ON ea.user_id = u.id
      WHERE ea.event_id = ?
    `;
    
    db.get(eventSql, [req.params.id], (err, event) => {
      if (err) {
        console.error('Get event error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      db.all(attendeesSql, [req.params.id], (err, attendees) => {
        if (err) {
          console.error('Get attendees error:', err);
          return res.status(500).json({ message: 'Server error', error: err.message });
        }
        
        res.json({
          ...event,
          attendees: attendees || []
        });
      });
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new event with attendees
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, date, time, location, attendeeIds } = req.body;
    
    console.log('Creating event:', { title, date, time, location, attendeeIds });
    
    if (!title || !date || !time || !location) {
      return res.status(400).json({ message: 'Title, date, time, and location are required' });
    }
    
    // Insert event
    const eventSql = `INSERT INTO events (title, description, date, time, location, organizer_id) 
                      VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(eventSql, [title, description, date, time, location, req.userId], function(err) {
      if (err) {
        console.error('Create event error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      
      const eventId = this.lastID;
      console.log('Event created with ID:', eventId);
      
      // Add attendees if provided
      if (attendeeIds && Array.isArray(attendeeIds) && attendeeIds.length > 0) {
        const attendeeSql = `INSERT INTO event_attendees (event_id, user_id) VALUES (?, ?)`;
        
        let completed = 0;
        const errors = [];
        
        attendeeIds.forEach(attendeeId => {
          db.run(attendeeSql, [eventId, attendeeId], (err) => {
            completed++;
            if (err) {
              console.error('Add attendee error:', err);
              errors.push(err);
            }
            
            if (completed === attendeeIds.length) {
              console.log(`Added ${attendeeIds.length} attendees to event ${eventId}`);
              
              // Return response
              res.status(201).json({
                id: eventId,
                title,
                description,
                date,
                time,
                location,
                organizer_id: req.userId,
                attendee_count: attendeeIds.length
              });
            }
          });
        });
      } else {
        res.status(201).json({
          id: eventId,
          title,
          description,
          date,
          time,
          location,
          organizer_id: req.userId,
          attendee_count: 0
        });
      }
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update event
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, date, time, location, attendeeIds } = req.body;
    
    console.log('Updating event:', req.params.id, req.body);
    
    // Check if user owns the event
    db.get('SELECT * FROM events WHERE id = ? AND organizer_id = ?', 
           [req.params.id, req.userId], (err, event) => {
      if (err) {
        console.error('Check event owner error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (!event) {
        return res.status(404).json({ message: 'Event not found or unauthorized' });
      }
      
      // Update event
      const updateSql = `UPDATE events SET title = ?, description = ?, date = ?, 
                         time = ?, location = ? WHERE id = ?`;
      
      db.run(updateSql, [title, description, date, time, location, req.params.id], (err) => {
        if (err) {
          console.error('Update event error:', err);
          return res.status(500).json({ message: 'Server error', error: err.message });
        }
        
        console.log('Event updated successfully:', req.params.id);
        
        res.json({
          id: req.params.id,
          title,
          description,
          date,
          time,
          location,
          organizer_id: req.userId
        });
      });
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete event
router.delete('/:id', auth, async (req, res) => {
  try {
    console.log('Deleting event:', req.params.id);
    
    // Check if user owns the event
    db.get('SELECT * FROM events WHERE id = ? AND organizer_id = ?', 
           [req.params.id, req.userId], (err, event) => {
      if (err) {
        console.error('Check event owner error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (!event) {
        return res.status(404).json({ message: 'Event not found or unauthorized' });
      }
      
      // Delete event (attendees will be deleted automatically due to CASCADE)
      db.run('DELETE FROM events WHERE id = ?', [req.params.id], (err) => {
        if (err) {
          console.error('Delete event error:', err);
          return res.status(500).json({ message: 'Server error', error: err.message });
        }
        
        console.log('Event deleted successfully:', req.params.id);
        res.json({ message: 'Event deleted successfully' });
      });
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;