const express = require('express');
const jwt = require('jsonwebtoken');
const Event = require('../models/Event');
const User = require('../models/User');
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

// Get all events for user
router.get('/', auth, async (req, res) => {
  try {
    const events = await Event.findByUser(req.userId);
    
    // Get attendees for each event
    const eventsWithAttendees = await Promise.all(
      events.map(async (event) => {
        const attendees = await Event.getAttendees(event.id);
        return {
          ...event,
          attendees,
          attendeeCount: attendees.length
        };
      })
    );
    
    res.json(eventsWithAttendees);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create event
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, startTime, endTime, location, attendees } = req.body;
    
    // Create event
    const event = await Event.create({
      title,
      description,
      startTime,
      endTime,
      location,
      creatorId: req.userId
    });
    
    // Add attendees if provided
    if (attendees && attendees.length > 0) {
      await Event.addAttendees(event.id, attendees);
    }
    
    // Get event details with creator info
    const eventWithDetails = await Event.findByIdWithDetails(event.id);
    const eventAttendees = await Event.getAttendees(event.id);
    
    const eventResponse = {
      ...eventWithDetails,
      creator: {
        id: eventWithDetails.creatorId,
        name: eventWithDetails.creatorName,
        email: eventWithDetails.creatorEmail
      },
      attendees: eventAttendees,
      attendeeCount: eventAttendees.length
    };
    
    // Send notifications to attendees
    if (eventAttendees.length > 0) {
      try {
        const creator = await User.findById(req.userId);
        
        // Configure nodemailer
        const transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        
        // Send email to each attendee
        for (const attendee of eventAttendees) {
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: attendee.email,
            subject: `Invitation: ${title}`,
            html: `
              <h2>You've been invited to an event</h2>
              <p><strong>Event:</strong> ${title}</p>
              <p><strong>Description:</strong> ${description}</p>
              <p><strong>Time:</strong> ${new Date(startTime).toLocaleString()} - ${new Date(endTime).toLocaleString()}</p>
              <p><strong>Location/Link:</strong> ${location}</p>
              <p><strong>Organizer:</strong> ${creator.name} (${creator.email})</p>
            `
          };
          
          try {
            await transporter.sendMail(mailOptions);
          } catch (emailError) {
            console.error('Failed to send email to', attendee.email, emailError);
          }
        }
      } catch (emailError) {
        console.error('Email configuration error', emailError);
      }
    }
    
    res.status(201).json(eventResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update event
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, startTime, endTime, location, attendees } = req.body;
    const eventId = req.params.id;
    
    // Check if the user is the creator of the event
    const isCreator = await Event.isCreator(eventId, req.userId);
    if (!isCreator) {
      return res.status(403).json({ message: 'Access denied. Only event creator can update.' });
    }
    
    // Update event details
    await Event.update(eventId, { title, description, startTime, endTime, location });
    
    // Update attendees if provided
    if (attendees) {
      // First remove all existing attendees
      await Event.clearAttendees(eventId);
      
      // Add new attendees if any
      if (attendees.length > 0) {
        await Event.addAttendees(eventId, attendees);
      }
    }
    
    // Get updated event with all details
    const updatedEvent = await Event.findByIdWithDetails(eventId);
    const eventAttendees = await Event.getAttendees(eventId);
    
    const eventResponse = {
      ...updatedEvent,
      creator: {
        id: updatedEvent.creatorId,
        name: updatedEvent.creatorName,
        email: updatedEvent.creatorEmail
      },
      attendees: eventAttendees,
      attendeeCount: eventAttendees.length
    };
    
    res.json(eventResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete event
router.delete('/:id', auth, async (req, res) => {
  try {
    const eventId = req.params.id;
    
    // Check if the user is the creator of the event
    const isCreator = await Event.isCreator(eventId, req.userId);
    if (!isCreator) {
      return res.status(403).json({ message: 'Access denied. Only event creator can delete.' });
    }
    
    // Delete the event
    await Event.delete(eventId);
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get event by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const eventId = req.params.id;
    
    // Get event details
    const event = await Event.findByIdWithDetails(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Get attendees
    const attendees = await Event.getAttendees(eventId);
    
    const eventResponse = {
      ...event,
      creator: {
        id: event.creatorId,
        name: event.creatorName,
        email: event.creatorEmail
      },
      attendees,
      attendeeCount: attendees.length
    };
    
    res.json(eventResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;