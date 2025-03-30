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
    // FOR TESTING: Always use the Resend test email
    const testEmail = "delivered@resend.dev"; // This is Resend's test email address
    
    console.log('Sending email with the following data:');
    console.log({
      to: testEmail, // In production, this would be recipientEmail
      recipientName,
      subject,
      originalMessage: originalMessage ? originalMessage.substring(0, 100) + '...' : 'No original message',
      replyTextLength: replyText ? replyText.length : 0
    });

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'Merisols Times <onboarding@resend.dev>', // Use Resend's shared domain for testing
      to: testEmail, // Always send to the test email during development
      // For production, you would use: to: recipientEmail,
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

module.exports = router;