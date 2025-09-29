import dotenv from 'dotenv';
import notificationService from './services/notificationService.js';

// Load environment variables
dotenv.config({ path: './config.env' });

console.log('🧪 Testing Notification Service...');
console.log('📧 Gmail Email:', process.env.GMAIL_EMAIL);
console.log('🔑 Gmail App Password:', process.env.GMAIL_APP_PASSWORD ? 'Set' : 'Not set');

// Test the notification service
async function testNotificationService() {
  try {
    
    console.log('📤 Testing email sending...');
    
    const result = await notificationService.sendEmail(
      process.env.GMAIL_EMAIL, // Send to self
      '🧪 Abai Springs - Notification Service Test',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1>🌊 Abai Springs</h1>
            <p>Notification Service Test</p>
          </div>
          <div style="padding: 20px; background: #f8f9fa;">
            <h2>✅ Notification Service Working!</h2>
            <p>The notification service is now properly configured and ready to send order confirmations.</p>
            <ul>
              <li>✅ Gmail SMTP: Configured</li>
              <li>✅ Email Sending: Working</li>
              <li>✅ Order Notifications: Ready</li>
            </ul>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `,
      'Abai Springs Notification Service Test - Ready for order notifications!'
    );
    
    if (result.success) {
      console.log('✅ Notification service test successful!');
      console.log('📧 Message ID:', result.messageId);
      console.log('🎉 Ready to send order notifications!');
    } else {
      console.log('❌ Notification service test failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testNotificationService();
