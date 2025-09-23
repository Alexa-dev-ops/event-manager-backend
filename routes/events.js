// routes/events.js
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../utils/db'); // ✅ Use promisified version
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

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
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
    
    const rows = await db.all(sql, [req.userId, req.userId]);
    res.json(rows || []);
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
    
    const event = await db.get(eventSql, [req.params.id]);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const attendees = await db.all(attendeesSql, [req.params.id]);
    
    res.json({
      ...event,
      attendees: attendees || []
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new event
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, date, time, location, attendeeIds } = req.body;
    
    if (!title || !date || !time || !location) {
      return res.status(400).json({ message: 'Title, date, time, and location are required' });
    }
    
    const result = await db.run(
      `INSERT INTO events (title, description, date, time, location, organizer_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, date, time, location, req.userId]
    );
    
    const eventId = result.lastID;
    
    if (attendeeIds && Array.isArray(attendeeIds) && attendeeIds.length > 0) {
      const attendeeSql = `INSERT INTO event_attendees (event_id, user_id) VALUES (?, ?)`;
      for (const attendeeId of attendeeIds) {
        await db.run(attendeeSql, [eventId, attendeeId]);
      }
      
      // Send notifications (fire and forget)
      sendEventNotifications(eventId, { title, description, date, time, location }, attendeeIds)
        .catch(console.error);
    }
    
    res.status(201).json({
      id: eventId,
      title,
      description,
      date,
      time,
      location,
      organizer_id: req.userId,
      attendee_count: attendeeIds?.length || 0
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
    
    const event = await db.get('SELECT * FROM events WHERE id = ? AND organizer_id = ?', 
                               [req.params.id, req.userId]);
    if (!event) {
      return res.status(404).json({ message: 'Event not found or unauthorized' });
    }
    
    await db.run(
      `UPDATE events SET title = ?, description = ?, date = ?, time = ?, location = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [title, description, date, time, location, req.params.id]
    );
    
    if (attendeeIds !== undefined) {
      await db.run('DELETE FROM event_attendees WHERE event_id = ?', [req.params.id]);
      
      if (Array.isArray(attendeeIds) && attendeeIds.length > 0) {
        const attendeeSql = `INSERT INTO event_attendees (event_id, user_id) VALUES (?, ?)`;
        for (const attendeeId of attendeeIds) {
          await db.run(attendeeSql, [req.params.id, attendeeId]);
        }
      }
    }
    
    res.json({
      id: req.params.id,
      title,
      description,
      date,
      time,
      location,
      organizer_id: req.userId,
      attendee_count: attendeeIds?.length || 0
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete event
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await db.get('SELECT * FROM events WHERE id = ? AND organizer_id = ?', 
                               [req.params.id, req.userId]);
    if (!event) {
      return res.status(404).json({ message: 'Event not found or unauthorized' });
    }
    
    await db.run('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Event deleted successfully' });
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
    
    const placeholders = attendeeIds.map(() => '?').join(',');
    const sql = `SELECT email, name FROM users WHERE id IN (${placeholders})`;
    const users = await db.all(sql, attendeeIds);
    
    for (const user of users) {
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
      
      await transporter.sendMail(mailOptions);
      console.log('Email sent to', user.email);
    }
  } catch (error) {
    console.error('Error in sendEventNotifications:', error);
  }
}

module.exports = router;