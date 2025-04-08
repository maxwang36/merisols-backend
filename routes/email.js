const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Endpoint to send email replies
router.post('/send-reply', async (req, res) => {
  const { 
    recipientEmail, 
    recipientName, 
    subject, 
    originalMessage, 
    replyText,
    messageId
  } = req.body;

  if (!replyText || !subject) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const testEmail = "delivered@resend.dev"; // This is Resend's test email address

    console.log('Sending email with the following data:');
    console.log({
      to: testEmail,
      recipientName,
      subject,
      originalMessage: originalMessage ? originalMessage.substring(0, 100) + '...' : 'No original message',
      replyTextLength: replyText ? replyText.length : 0
    });

    const { data, error } = await resend.emails.send({
      from: 'Merisols Times <onboarding@resend.dev>',
      to: testEmail,
      subject: `Re: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #333; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Merisols Times</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
            <p>Dear ${recipientName},</p>
            <p>Thank you for contacting us. Below is our response to your inquiry:</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #333; margin: 20px 0;">
              ${replyText.replace(/\n/g, '<br>')}
            </div>
            <p style="margin-top: 30px;"><strong>Your original message:</strong></p>
            <div style="background-color: #f5f5f5; padding: 15px; color: #666; font-style: italic;">
              ${originalMessage?.replace(/\n/g, '<br>') || 'No original message provided'}
            </div>
            <p style="margin-top: 30px; font-size: 13px; color: #777;">
              This is an automated response. Please do not reply to this email. If you have further questions, 
              please submit a new inquiry through our contact form.
            </p>
          </div>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            <p>© ${new Date().getFullYear()} Merisols Times. All rights reserved.</p>
            <p>461 Clementi Road, Singapore 599491</p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('Email sending error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send email', 
        error: error.message 
      });
    }

    console.log('Email sent successfully to test address:', testEmail);
    console.log('Resend response data:', data);

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully to test address',
      data,
      note: 'This is a development environment. Email was sent to Resend test email instead of the actual recipient.'
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send email', 
      error: error.message 
    });
  }
});

// New endpoint: Notify admin when user submits article
router.post('/new-article-notification', async (req, res) => {
  const { userId, timeSent, priority, category, title } = req.body;

  if (!userId || !title || !category) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const formattedMessage = `
    ----------------- User Article Submission -----------------<br><br>
    <strong>User ID:</strong> ${userId}<br>
    <strong>Time Sent:</strong> ${new Date(timeSent).toLocaleString()}<br>
    <strong>Priority:</strong> ${priority || 'Normal'}<br>
    <strong>Category:</strong> ${category}<br>
    <strong>Title:</strong> ${title}
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Merisols Times <onboarding@resend.dev>',
      to: process.env.ADMIN_EMAIL || "delivered@resend.dev",
      subject: `📝 New Article Submitted: \"${title}\"`,
      html: formattedMessage
    });

    if (error) {
      console.error('Admin notification email error:', error);
      return res.status(500).json({ success: false, message: 'Failed to send email', error: error.message });
    }

    console.log('Admin email notification sent:', data);
    return res.status(200).json({ success: true, message: 'Admin email sent successfully', data });
  } catch (error) {
    console.error('Admin notification send error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send email', error: error.message });
  }
});

module.exports = router;
