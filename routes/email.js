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
  const { userId, username, timeSent, priority, category, title, content } = req.body;


  if (!userId || !title || !category) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const formattedMessage = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="text-align: center; font-weight: bold;">USER ARTICLE SUBMISSION</h2>
    
    <p><strong>User ID:</strong> ${userId}</p>
    <p><strong>Username:</strong> ${username || 'Unknown'}</p>
    <p><strong>Time Sent:</strong> ${new Date(timeSent).toLocaleString()}</p>
    <p><strong>Priority:</strong> ${priority == 1 ? 'High' : priority == 2 ? 'Medium' : 'Low'}</p>
    <p><strong>Category:</strong> ${category}</p>
    <p><strong>Title:</strong> ${title}</p>

    <p><strong>Content:</strong></p>
    <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin-top: 5px;">
      ${content ? content.split(/\s+/).slice(0, 100).join(' ') + (content.split(/\s+/).length > 100 ? '...' : '') : 'No content provided'}
    </div>
  </div>
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

// Notify user about ban/soft ban/unban/unsoft ban
router.post('/send-ban-notification', async (req, res) => {
  const { type, recipientEmail, recipientName } = req.body;

  if (!recipientEmail || !recipientName || !type) {
    return res.status(400).json({ success: false, message: 'Missing email fields' });
  }

  const typeMap = {
    ban: {
      subject: 'You have been banned from Merisols Times',
      message: `We regret to inform you that your account has been banned for violating our community guidelines.`
    },
    softban: {
      subject: 'Temporary Soft Ban on Your Merisols Times Account',
      message: `You have been temporarily restricted from posting or commenting for 7 days.`
    },
    unban: {
      subject: 'Your Ban Has Been Lifted',
      message: `Your account ban has been lifted. You may now access all features again.`
    },
    unsoftban: {
      subject: 'Your Soft Ban Has Been Lifted',
      message: `Your posting and commenting privileges have been restored.`
    }
  };

  const template = typeMap[type];

  try {
    const { error } = await resend.emails.send({
      from: 'Merisols Times <onboarding@resend.dev>',
      to: recipientEmail,
      subject: template.subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #e74c3c;">Merisols Times</h2>
          <p>Dear ${recipientName},</p>
          <p>${template.message}</p>
          <p style="margin-top: 20px;">For further information, you may contact support or review our community policies.</p>
        </div>
      `
    });

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Email sent.' });
  } catch (err) {
    console.error('Failed to send ban-related email:', err.message);
    res.status(500).json({ success: false, message: 'Email failed', error: err.message });
  }
});

module.exports = router;
