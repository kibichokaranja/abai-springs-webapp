import nodemailer from 'nodemailer';

/**
 * Email service for sending emails
 */

// Create transporter (you'll need to configure this with your email provider)
const createTransporter = () => {
  return nodemailer.createTransporter({
    // Configure based on your email provider
    // For Gmail: use OAuth2 or app-specific password
    // For other providers: use their SMTP settings
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @returns {Object} Send result
 */
export async function sendEmail(options) {
  try {
    const { to, subject, text, html } = options;
    
    if (!to || !subject) {
      throw new Error('Email recipient and subject are required');
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', result.messageId);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully'
    };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send bulk emails
 * @param {Array} emailList - Array of email objects
 * @returns {Object} Bulk send result
 */
export async function sendBulkEmails(emailList) {
  const results = {
    total: emailList.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const emailData of emailList) {
    try {
      await sendEmail(emailData);
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        email: emailData.to,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Send email with template
 * @param {string} template - Template name
 * @param {Object} data - Template data
 * @param {Object} options - Email options
 * @returns {Object} Send result
 */
export async function sendTemplateEmail(template, data, options) {
  // This would integrate with a template engine like Handlebars
  // For now, return a basic implementation
  const { to, subject } = options;
  
  let html = '';
  let text = '';
  
  switch (template) {
    case 'welcome':
      html = `<h1>Welcome to Abai Springs!</h1><p>Hello ${data.name}, welcome to our service!</p>`;
      text = `Welcome to Abai Springs! Hello ${data.name}, welcome to our service!`;
      break;
    case 'order_confirmation':
      html = `<h1>Order Confirmed</h1><p>Your order #${data.orderId} has been confirmed.</p>`;
      text = `Order Confirmed. Your order #${data.orderId} has been confirmed.`;
      break;
    case 'delivery_update':
      html = `<h1>Delivery Update</h1><p>Your delivery status: ${data.status}</p>`;
      text = `Delivery Update. Your delivery status: ${data.status}`;
      break;
    default:
      html = `<h1>${subject}</h1><p>${data.message}</p>`;
      text = `${subject}. ${data.message}`;
  }
  
  return await sendEmail({
    to,
    subject,
    text,
    html
  });
}













































