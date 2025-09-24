// services/emailService.js
const SibApiV3Sdk = require('sib-api-v3-sdk');

const client = SibApiV3Sdk.ApiClient.instance;
const apiKeyAuth = client.authentications['api-key'];
apiKeyAuth.apiKey = process.env.BREVO_API_KEY || '';

const transactionalEmailsApi = new SibApiV3Sdk.TransactionalEmailsApi();

const formatDate = (dateStr) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
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
  } catch {
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
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Event Reminder</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .event-card { background: #f8f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .event-title { font-size: 20px; font-weight: 600; margin: 0 0 15px 0; }
        .event-details { display: grid; gap: 10px; }
        .detail-row { display: flex; align-items: center; gap: 10px; }
        .detail-text { font-size: 14px; color: #666; }
        .description { margin: 20px 0; padding: 15px; background: #fff; border-radius: 4px; border: 1px solid #eee; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-top: 1px solid #eee; }
        .organizer-info { background: #fff; border: 1px solid #eee; border-radius: 4px; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Event Reminder</h1>
          <p>Don't forget about your upcoming event!</p>
        </div>
        <div class="content">
          <p>Hi <strong>${attendeeName}</strong>,</p>
          <p>This is a friendly reminder about the upcoming event you're invited to:</p>
          <div class="event-card">
            <div class="event-title">${eventTitle}</div>
            <div class="event-details">
              <div class="detail-row"><span class="detail-text"><strong>Date:</strong> ${formatDate(eventDate)}</span></div>
              <div class="detail-row"><span class="detail-text"><strong>Time:</strong> ${formatTime(eventTime)}</span></div>
              <div class="detail-row"><span class="detail-text"><strong>Location:</strong> ${eventLocation}</span></div>
            </div>
            ${eventDescription ? `<div class="description"><strong>Description:</strong><br>${eventDescription}</div>` : ''}
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

const buildTextContent = (eventData) => `
Hi ${eventData.attendeeName},

This is a reminder about the upcoming event you're invited to:

Event: ${eventData.eventTitle}
Date: ${formatDate(eventData.eventDate)}
Time: ${formatTime(eventData.eventTime)}
Location: ${eventData.eventLocation}

${eventData.eventDescription ? `Description: ${eventData.eventDescription}` : ''}

Organized by: ${eventData.organizerName} (${eventData.organizerEmail})

--
Event Manager
`;

const emailService = {
  sendEventReminder: async (eventData, maxRetries = 3) => {
    let lastError;
    const sender = {
      name: process.env.EMAIL_FROM_NAME || 'Event Manager', // can be your Gmail as name
      email: process.env.EMAIL_FROM_ADDRESS || process.env.BREVO_SENDER || '' // must be Brevo verified sender
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Email attempt ${attempt} for ${eventData.to}`);

        const sendSmtpEmail = {
          sender,
          to: [{ email: eventData.to, name: eventData.attendeeName || '' }],
          subject: `Reminder: ${eventData.eventTitle} - ${formatDate(eventData.eventDate)}`,
          htmlContent: generateEventReminderHTML(eventData),
          textContent: buildTextContent(eventData)
        };

        const response = await transactionalEmailsApi.sendTransacEmail(sendSmtpEmail);

        console.log(`Email sent successfully to ${eventData.to}:`, response?.messageId || response);
        return { success: true, messageId: response?.messageId || null, recipient: eventData.to };
      } catch (err) {
        const errMsg = err?.message || JSON.stringify(err);
        console.error(`Email attempt ${attempt} failed:`, errMsg);
        lastError = err;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to send email to ${eventData.to} after ${maxRetries} attempts: ${lastError?.message || String(lastError)}`);
  }
};

module.exports = emailService;
