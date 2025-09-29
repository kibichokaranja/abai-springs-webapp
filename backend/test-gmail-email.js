import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config({ path: './config.env' });

console.log('🧪 Testing Gmail Email Configuration...');
console.log('📧 Email:', process.env.GMAIL_EMAIL);
console.log('🔑 App Password configured:', process.env.GMAIL_APP_PASSWORD ? 'Yes' : 'No');

// Create transporter
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Test email configuration
async function testEmail() {
  try {
    console.log('🔍 Verifying Gmail SMTP connection...');
    
    // Verify connection
    await emailTransporter.verify();
    console.log('✅ Gmail SMTP connection verified successfully!');
    
    // Send test email
    console.log('📤 Sending test email...');
    
    const mailOptions = {
      from: `"Abai Springs" <${process.env.GMAIL_EMAIL}>`,
      to: process.env.GMAIL_EMAIL, // Send to self for testing
      subject: '🧪 Abai Springs - Gmail Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1>🌊 Abai Springs</h1>
            <p>Gmail Email System Test</p>
          </div>
          <div style="padding: 20px; background: #f8f9fa;">
            <h2>✅ Gmail Configuration Successful!</h2>
            <p>Your Gmail email system is working perfectly.</p>
            <ul>
              <li>✅ SMTP Connection: Working</li>
              <li>✅ Authentication: Successful</li>
              <li>✅ Email Sending: Functional</li>
            </ul>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>From:</strong> ${process.env.GMAIL_EMAIL}</p>
          </div>
          <div style="background: #e9ecef; padding: 15px; text-align: center; color: #6c757d;">
            <p>This is a test email from your Abai Springs notification system.</p>
            <p>🎉 Ready to send real order notifications!</p>
          </div>
        </div>
      `,
      text: 'Abai Springs Gmail Test - Your email system is working! Ready to send real order notifications!'
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Check your inbox at:', process.env.GMAIL_EMAIL);
    console.log('🎉 Gmail email system is ready for production!');
    
  } catch (error) {
    console.error('❌ Gmail test failed:', error.message);
    console.error('🔍 Full error:', error);
  }
}

// Run the test
testEmail();























