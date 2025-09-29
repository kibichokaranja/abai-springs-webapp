import { sendEmail } from './emailService.js';
import { sendSMS } from './smsService.js';
import { sendPushNotification } from './pushService.js';

/**
 * Send alert notification through multiple channels
 * @param {Object} alertData - Alert configuration
 * @returns {Object} Result of alert sending
 */
export async function sendAlertNotification(alertData) {
  const {
    type,
    customer,
    product,
    outlet,
    message,
    deliveryMethods,
    priority,
    schedule,
    scheduleTime,
    sentBy
  } = alertData;

  const results = {
    alertId: generateAlertId(),
    type,
    customer,
    outlet,
    message,
    deliveryMethods,
    priority,
    schedule,
    scheduleTime,
    sentBy,
    sentAt: new Date(),
    status: 'sent',
    deliveryResults: {}
  };

  // If scheduled, store for later processing
  if (schedule === 'scheduled') {
    return await scheduleAlert(alertData);
  }

  // Process immediate alerts
  try {
    // Get customer details
    const customerDetails = await getCustomerDetails(customer);
    if (!customerDetails) {
      throw new Error('Customer not found');
    }

    // Get outlet details
    const outletDetails = await getOutletDetails(outlet);
    if (!outletDetails) {
      throw new Error('Outlet not found');
    }

    // Get product details if specified
    let productDetails = null;
    if (product) {
      productDetails = await getProductDetails(product);
    }

    // Process each delivery method
    for (const method of deliveryMethods) {
      try {
        let result;
        
        switch (method) {
          case 'email':
            result = await sendEmailAlert(customerDetails, message, {
              type,
              outlet: outletDetails,
              product: productDetails,
              priority
            });
            break;
            
          case 'sms':
            result = await sendSMSAlert(customerDetails, message, {
              type,
              outlet: outletDetails,
              product: productDetails,
              priority
            });
            break;
            
          case 'push':
            result = await sendPushAlert(customerDetails, message, {
              type,
              outlet: outletDetails,
              product: productDetails,
              priority
            });
            break;
        }
        
        results.deliveryResults[method] = {
          success: true,
          result: result
        };
      } catch (error) {
        console.error(`Error sending ${method} alert:`, error);
        results.deliveryResults[method] = {
          success: false,
          error: error.message
        };
      }
    }

    // Check if any delivery method succeeded
    const hasSuccess = Object.values(results.deliveryResults).some(r => r.success);
    if (!hasSuccess) {
      results.status = 'failed';
      throw new Error('All delivery methods failed');
    }

    return results;
  } catch (error) {
    console.error('Error sending alert:', error);
    results.status = 'failed';
    results.error = error.message;
    throw error;
  }
}

/**
 * Send email alert
 */
async function sendEmailAlert(customer, message, context) {
  const { type, outlet, product, priority } = context;
  
  // Customize message based on alert type
  let subject = 'Abai Springs Alert';
  let emailMessage = message;
  
  switch (type) {
    case 'stock_low':
      subject = `Low Stock Alert - ${product?.name || 'Product'}`;
      emailMessage = `Dear ${customer.name},\n\n${message}\n\nProduct: ${product?.name || 'N/A'}\nOutlet: ${outlet.name}\n\nBest regards,\nAbai Springs Team`;
      break;
    case 'stock_critical':
      subject = `URGENT: Critical Stock Alert - ${product?.name || 'Product'}`;
      emailMessage = `Dear ${customer.name},\n\n${message}\n\nProduct: ${product?.name || 'N/A'}\nOutlet: ${outlet.name}\n\nThis is a high-priority alert.\n\nBest regards,\nAbai Springs Team`;
      break;
    case 'promotional':
      subject = 'Special Offer - Abai Springs';
      emailMessage = `Dear ${customer.name},\n\n${message}\n\nBest regards,\nAbai Springs Team`;
      break;
    case 'delivery':
      subject = 'Delivery Update - Abai Springs';
      emailMessage = `Dear ${customer.name},\n\n${message}\n\nBest regards,\nAbai Springs Team`;
      break;
    default:
      subject = 'Notification from Abai Springs';
      emailMessage = `Dear ${customer.name},\n\n${message}\n\nBest regards,\nAbai Springs Team`;
  }

  return await sendEmail({
    to: customer.email,
    subject: subject,
    text: emailMessage,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">💧 Abai Springs</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #2c3e50; margin-bottom: 20px;">${subject}</h2>
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="color: #333; line-height: 1.6; margin: 0;">${emailMessage.replace(/\n/g, '<br>')}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="http://localhost:3001" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Visit Our Website</a>
          </div>
        </div>
        <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 Abai Springs. All rights reserved.</p>
        </div>
      </div>
    `
  });
}

/**
 * Send SMS alert
 */
async function sendSMSAlert(customer, message, context) {
  const { type, outlet, product, priority } = context;
  
  // Customize SMS message (shorter)
  let smsMessage = message;
  
  if (type === 'stock_low' || type === 'stock_critical') {
    smsMessage = `Abai Springs Alert: ${message} - ${product?.name || 'Product'} at ${outlet.name}`;
  } else {
    smsMessage = `Abai Springs: ${message}`;
  }
  
  // Truncate if too long
  if (smsMessage.length > 160) {
    smsMessage = smsMessage.substring(0, 157) + '...';
  }

  return await sendSMS({
    to: customer.phone,
    message: smsMessage
  });
}

/**
 * Send push notification alert
 */
async function sendPushAlert(customer, message, context) {
  const { type, outlet, product, priority } = context;
  
  let title = 'Abai Springs Alert';
  let body = message;
  
  switch (type) {
    case 'stock_low':
      title = 'Low Stock Alert';
      body = `${product?.name || 'Product'} is running low at ${outlet.name}`;
      break;
    case 'stock_critical':
      title = 'Critical Stock Alert';
      body = `URGENT: ${product?.name || 'Product'} is critically low at ${outlet.name}`;
      break;
    case 'promotional':
      title = 'Special Offer';
      body = message;
      break;
    case 'delivery':
      title = 'Delivery Update';
      body = message;
      break;
  }

  return await sendPushNotification({
    to: customer._id, // Assuming customer has push token
    title: title,
    body: body,
    data: {
      type: type,
      outlet: outlet._id,
      product: product?._id,
      priority: priority
    }
  });
}

/**
 * Schedule alert for later sending
 */
async function scheduleAlert(alertData) {
  // This would typically store the alert in a database with a scheduled time
  // For now, return a mock response
  return {
    alertId: generateAlertId(),
    status: 'scheduled',
    scheduledFor: alertData.scheduleTime,
    message: 'Alert scheduled successfully'
  };
}

/**
 * Get customer details
 */
async function getCustomerDetails(customerId) {
  // This would typically query a Customer model
  // For now, return mock data
  if (customerId === 'all') {
    return { name: 'All Customers', email: 'all@abaisprings.com', phone: '+254000000000' };
  }
  
  // Mock customer data
  return {
    _id: customerId,
    name: 'John Doe',
    email: customerId,
    phone: '+254712345678'
  };
}

/**
 * Get outlet details
 */
async function getOutletDetails(outletId) {
  // This would typically query an Outlet model
  // For now, return mock data
  if (outletId === 'all') {
    return { _id: 'all', name: 'All Outlets' };
  }
  
  // Mock outlet data
  return {
    _id: outletId,
    name: 'Main Outlet',
    location: 'Nairobi'
  };
}

/**
 * Get product details
 */
async function getProductDetails(productId) {
  // This would typically query a Product model
  // For now, return mock data
  return {
    _id: productId,
    name: 'Premium Water',
    brand: 'Abai Springs',
    category: '500ml'
  };
}

/**
 * Generate unique alert ID
 */
function generateAlertId() {
  return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}










