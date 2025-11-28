import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config({ path: './config.env' });

console.log('📱 Testing Twilio SMS Configuration...');
console.log('🔑 Account SID:', process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured');
console.log('🔐 Auth Token:', process.env.TWILIO_AUTH_TOKEN ? 'Configured' : 'Not configured');
console.log('📞 SMS From:', process.env.TWILIO_SMS_FROM || 'Not configured');

async function testTwilioSMS() {
  try {
    // Check if credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log('❌ Twilio credentials not configured in config.env');
      console.log('📝 Please add your Twilio credentials:');
      console.log('   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      console.log('   TWILIO_AUTH_TOKEN=your_auth_token_here');
      console.log('   TWILIO_SMS_FROM=+1234567890');
      return;
    }

    // Initialize Twilio client
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio client initialized successfully');

    // Test phone number (replace with your actual phone number)
    const testPhoneNumber = '+254741219623'; // Your phone number
    const testMessage = '🧪 Abai Springs SMS Test - Twilio SMS is working!';

    console.log('📤 Sending test SMS...');
    console.log('📞 To:', testPhoneNumber);
    console.log('💬 Message:', testMessage);

    const message = await client.messages.create({
      from: process.env.TWILIO_SMS_FROM,
      to: testPhoneNumber,
      body: testMessage
    });

    console.log('✅ SMS sent successfully!');
    console.log('📧 Message SID:', message.sid);
    console.log('📱 Check your phone for the test message!');
    console.log('🎉 Twilio SMS is ready for production!');

  } catch (error) {
    console.error('❌ Twilio SMS test failed:', error.message);
    
    if (error.code === 21211) {
      console.log('💡 Tip: Make sure your Twilio phone number is verified');
    } else if (error.code === 21608) {
      console.log('💡 Tip: Make sure your Twilio account has sufficient balance');
    } else if (error.code === 21214) {
      console.log('💡 Tip: Make sure the "from" phone number is valid');
    }
    
    console.log('🔍 Full error:', error);
  }
}

testTwilioSMS();
























































