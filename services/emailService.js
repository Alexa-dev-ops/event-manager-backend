// services/emailService.js - CREATE THIS NEW FILE
const nodemailer = require('nodemailer');


const createTransport = () => {
  if (process.env.EMAIL_SERVICE === 'gmail') {
    // Gmail configuration
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // 
        pass: process.env.EMAIL_APP_PASSWORD // 
      }
    });
  } else if (process.env.EMAIL_SERVICE === 'sendgrid') {
    // SendGrid configuration
    return nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  } else {
    // Generic SMTP configuration
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
};

const formatDate = (dateStr) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateStr;
  }
};

const formatTime = (timeStr) => {
  try {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return timeStr;
  }
};

const generateEventReminderHTML = (eventData) => {
  const {
    attendeeName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventDescription,
    organizerName,
    organizerEmail
  } = eventData;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Event Reminder</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          padding: 30px;
        }
        .event-card {
          background: #f8f9ff;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .event-title {
          font-size: 20px;
          font-weight: 600;
          color: #333;
          margin: 0 0 15px 0;
        }
        .event-details {
          display: grid;
          gap: 10px;
        }
        .detail-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .detail-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        .detail-text {
          font-size: 14px;
          color: #666;
        }
        .description {
          margin: 20px 0;
          padding: 15px;
          background: #fff;
          border-radius: 4px;
          border: 1px solid #eee;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          font-size: 14px;
          color: #666;
          border-top: 1px solid #eee;
        }
        .btn {
          display: inline-block;
          padding: 12px 24px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin: 15px 0;
          font-weight: 500;
        }
        .organizer-info {
          background: #fff;
          border: 1px solid #eee;
          border-radius: 4px;
          padding: 15px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Event Reminder</h1>
          <p>Don't forget about your upcoming event!</p>
        </div>
        
        <div class="content">
          <p>Hi <strong>${attendeeName}</strong>,</p>
          
          <p>This is a friendly reminder about the upcoming event you're invited to:</p>
          
          <div class="event-card">
            <div class="event-title">${eventTitle}</div>
            
            <div class="event-details">
              <div class="detail-row">
                <span class="detail-icon">📅</span>
                <span class="detail-text"><strong>Date:</strong> ${formatDate(eventDate)}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-icon">🕒</span>
                <span class="detail-text"><strong>Time:</strong> ${formatTime(eventTime)}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-icon">📍</span>
                <span class="detail-text"><strong>Location:</strong> ${eventLocation}</span>
              </div>
            </div>
            
            ${eventDescription ? `
            <div class="description">
              <strong>Description:</strong><br>
              ${eventDescription}
            </div>
            ` : ''}
          </div>
          
          <div class="organizer-info">
            <strong>Organized by:</strong> ${organizerName}<br>
            <strong>Contact:</strong> <a href="mailto:${organizerEmail}">${organizerEmail}</a>
          </div>
          
          <p>We look forward to seeing you there!</p>
        </div>
        
        <div class="footer">
          <p>This email was sent automatically by Event Manager.</p>
          <p>If you have any questions, please contact the event organizer.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const emailService = {
  // Send event reminder email
  sendEventReminder: async (eventData) => {
    try {
      const transporter = createTransport();
      
      const mailOptions = {
        from: `"Event Manager" <${process.env.EMAIL_USER}>`,
        to: eventData.to,
        subject: `Reminder: ${eventData.eventTitle} - ${formatDate(eventData.eventDate)}`,
        html: generateEventReminderHTML(eventData),
        // Also include plain text version
        text: `
Hi ${eventData.attendeeName},

This is a reminder about the upcoming event you're invited to:

Event: ${eventData.eventTitle}
Date: ${formatDate(eventData.eventDate)}
Time: ${formatTime(eventData.eventTime)}
Location: ${eventData.eventLocation}

${eventData.eventDescription ? `Description: ${eventData.eventDescription}` : ''}

Organized by: ${eventData.organizerName} (${eventData.organizerEmail})

We look forward to seeing you there!

--
Event Manager
        `
      };
      
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${eventData.to}:`, info.messageId);
      
      return {
        success: true,
        messageId: info.messageId,
        recipient: eventData.to
      };
      
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error(`Failed to send email to ${eventData.to}: ${error.message}`);
    }
  },

  // Test email configuration
  testEmailConfig: async () => {
    try {
      const transporter = createTransport();
      await transporter.verify();
      console.log('Email configuration is valid');
      return true;
    } catch (error) {
      console.error('Email configuration error:', error);
      return false;
    }
  }
};

module.exports = emailService;