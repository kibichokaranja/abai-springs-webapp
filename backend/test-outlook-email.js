import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config({ path: './config.env' });

console.log('🧪 Testing Outlook Email Configuration...');
console.log('📧 Email:', process.env.OUTLOOK_EMAIL);
console.log('🔑 Password configured:', process.env.OUTLOOK_PASSWORD ? 'Yes' : 'No');

// Create transporter
const emailTransporter = nodemailer.createTransport({
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.OUTLOOK_EMAIL,
    pass: process.env.OUTLOOK_PASSWORD
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

// Test email configuration
async function testEmail() {
  try {
    console.log('🔍 Verifying SMTP connection...');
    
    // Verify connection
    await emailTransporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    
    // Send test email
    console.log('📤 Sending test email...');
    
    const mailOptions = {
      from: `"Abai Springs" <${process.env.OUTLOOK_EMAIL}>`,
      to: process.env.OUTLOOK_EMAIL, // Send to self for testing
      subject: '🧪 Abai Springs - Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1>🌊 Abai Springs</h1>
            <p>Email System Test</p>
          </div>
          <div style="padding: 20px; background: #f8f9fa;">
            <h2>✅ Email Configuration Successful!</h2>
            <p>Your Outlook email system is working perfectly.</p>
            <ul>
              <li>✅ SMTP Connection: Working</li>
              <li>✅ Authentication: Successful</li>
              <li>✅ Email Sending: Functional</li>
            </ul>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div style="background: #e9ecef; padding: 15px; text-align: center; color: #6c757d;">
            <p>This is a test email from your Abai Springs notification system.</p>
          </div>
        </div>
      `,
      text: 'Abai Springs Email Test - Your email system is working!'
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Check your inbox at:', process.env.OUTLOOK_EMAIL);
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.error('🔍 Full error:', error);
  }
}

// Run the test
testEmail();
