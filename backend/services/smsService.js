import twilio from 'twilio';

/**
 * SMS service for sending text messages
 */

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send SMS message
 * @param {Object} options - SMS options
 * @param {string} options.to - Recipient phone number
 * @param {string} options.message - SMS message content
 * @param {string} options.from - Sender phone number (optional)
 * @returns {Object} Send result
 */
export async function sendSMS(options) {
  try {
    const { to, message, from } = options;
    
    if (!to || !message) {
      throw new Error('SMS recipient and message are required');
    }

    const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;
    
    if (!fromNumber) {
      throw new Error('Twilio phone number not configured');
    }

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to
    });
    
    console.log('SMS sent successfully:', result.sid);
    
    return {
      success: true,
      messageId: result.sid,
      message: 'SMS sent successfully',
      status: result.status
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

/**
 * Send bulk SMS messages
 * @param {Array} smsList - Array of SMS objects
 * @returns {Object} Bulk send result
 */
export async function sendBulkSMS(smsList) {
  const results = {
    total: smsList.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const smsData of smsList) {
    try {
      await sendSMS(smsData);
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        phone: smsData.to,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Send SMS with template
 * @param {string} template - Template name
 * @param {Object} data - Template data
 * @param {string} to - Recipient phone number
 * @returns {Object} Send result
 */
export async function sendTemplateSMS(template, data, to) {
  let message = '';
  
  switch (template) {
    case 'welcome':
      message = `Welcome to Abai Springs! Hello ${data.name}, thank you for joining us!`;
      break;
    case 'order_confirmation':
      message = `Order Confirmed! Your order #${data.orderId} has been confirmed. We'll notify you when it's ready.`;
      break;
    case 'delivery_update':
      message = `Delivery Update: Your order status is ${data.status}. ${data.message || ''}`;
      break;
    case 'stock_alert':
      message = `Stock Alert: ${data.product} is running low at ${data.outlet}. Order now to avoid stockout!`;
      break;
    case 'promotional':
      message = `Special Offer: ${data.message} Visit us at ${data.outlet || 'our nearest outlet'}!`;
      break;
    default:
      message = data.message || 'Message from Abai Springs';
  }
  
  return await sendSMS({
    to,
    message
  });
}

/**
 * Send verification SMS
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} code - Verification code
 * @returns {Object} Send result
 */
export async function sendVerificationSMS(phoneNumber, code) {
  const message = `Your Abai Springs verification code is: ${code}. This code expires in 10 minutes.`;
  
  return await sendSMS({
    to: phoneNumber,
    message
  });
}

/**
 * Send OTP SMS
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} otp - OTP code
 * @returns {Object} Send result
 */
export async function sendOTP(phoneNumber, otp) {
  const message = `Your Abai Springs OTP is: ${otp}. Do not share this code with anyone.`;
  
  return await sendSMS({
    to: phoneNumber,
    message
  });
}

/**
 * Check SMS delivery status
 * @param {string} messageId - Twilio message SID
 * @returns {Object} Delivery status
 */
export async function checkSMSStatus(messageId) {
  try {
    const message = await client.messages(messageId).fetch();
    
    return {
      messageId: message.sid,
      status: message.status,
      direction: message.direction,
      from: message.from,
      to: message.to,
      body: message.body,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      dateUpdated: message.dateUpdated,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage
    };
  } catch (error) {
    console.error('Error checking SMS status:', error);
    throw new Error(`Failed to check SMS status: ${error.message}`);
  }
}








