// routes/events.js - ADD THIS TO YOUR BACKEND
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
const nodemailer = require('nodemailer');
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

// Configure email transporter (add to your environment variables)
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Get all events for the current user
router.get('/', auth, async (req, res) => {
  try {
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
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      db.all(attendeesSql, [req.params.id], (err, attendees) => {
        if (err) {
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

// Create new event with attendees and send notifications
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, date, time, location, attendeeIds } = req.body;
    
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
      
      // Add attendees if provided
      if (attendeeIds && Array.isArray(attendeeIds) && attendeeIds.length > 0) {
        const attendeeSql = `INSERT INTO event_attendees (event_id, user_id) VALUES (?, ?)`;
        
        let completed = 0;
        const errors = [];
        
        attendeeIds.forEach(attendeeId => {
          db.run(attendeeSql, [eventId, attendeeId], (err) => {
            completed++;
            if (err) errors.push(err);
            
            if (completed === attendeeIds.length) {
              // Send email notifications
              sendEventNotifications(eventId, { title, description, date, time, location }, attendeeIds)
                .catch(console.error);
              
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
    
    // Check if user owns the event
    db.get('SELECT * FROM events WHERE id = ? AND organizer_id = ?', 
           [req.params.id, req.userId], (err, event) => {
      if (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (!event) {
        return res.status(404).json({ message: 'Event not found or unauthorized' });
      }
      
      // Update event
      const updateSql = `UPDATE events SET title = ?, description = ?, date = ?, 
                         time = ?, location = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
      
      db.run(updateSql, [title, description, date, time, location, req.params.id], (err) => {
        if (err) {
          return res.status(500).json({ message: 'Server error', error: err.message });
        }
        
        // Update attendees if provided
        if (attendeeIds !== undefined) {
          // Remove existing attendees
          db.run('DELETE FROM event_attendees WHERE event_id = ?', [req.params.id], (err) => {
            if (err) {
              return res.status(500).json({ message: 'Server error', error: err.message });
            }
            
            // Add new attendees
            if (attendeeIds && Array.isArray(attendeeIds) && attendeeIds.length > 0) {
              const attendeeSql = `INSERT INTO event_attendees (event_id, user_id) VALUES (?, ?)`;
              
              let completed = 0;
              attendeeIds.forEach(attendeeId => {
                db.run(attendeeSql, [req.params.id, attendeeId], (err) => {
                  completed++;
                  if (completed === attendeeIds.length) {
                    res.json({
                      id: req.params.id,
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
              res.json({
                id: req.params.id,
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
        } else {
          res.json({
            id: req.params.id,
            title,
            description,
            date,
            time,
            location,
            organizer_id: req.userId
          });
        }
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
    // Check if user owns the event
    db.get('SELECT * FROM events WHERE id = ? AND organizer_id = ?', 
           [req.params.id, req.userId], (err, event) => {
      if (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (!event) {
        return res.status(404).json({ message: 'Event not found or unauthorized' });
      }
      
      // Delete event (attendees will be deleted automatically due to CASCADE)
      db.run('DELETE FROM events WHERE id = ?', [req.params.id], (err) => {
        if (err) {
          return res.status(500).json({ message: 'Server error', error: err.message });
        }
        res.json({ message: 'Event deleted successfully' });
      });
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send email notifications
async function sendEventNotifications(eventId, eventData, attendeeIds) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email credentials not configured, skipping notifications');
      return;
    }
    
    // Get attendee email addresses
    const placeholders = attendeeIds.map(() => '?').join(',');
    const sql = `SELECT email, name FROM users WHERE id IN (${placeholders})`;
    
    db.all(sql, attendeeIds, (err, users) => {
      if (err) {
        console.error('Error getting attendee emails:', err);
        return;
      }
      
      users.forEach(user => {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: `Event Invitation: ${eventData.title}`,
          html: `
            <h2>You're invited to: ${eventData.title}</h2>
            <p><strong>Description:</strong> ${eventData.description || 'No description provided'}</p>
            <p><strong>Date:</strong> ${eventData.date}</p>
            <p><strong>Time:</strong> ${eventData.time}</p>
            <p><strong>Location/Link:</strong> ${eventData.location}</p>
            <br>
            <p>See you there!</p>
          `
        };
        
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email to', user.email, ':', error);
          } else {
            console.log('Email sent to', user.email, ':', info.response);
          }
        });
      });
    });
  } catch (error) {
    console.error('Error in sendEventNotifications:', error);
  }
}

module.exports = router;