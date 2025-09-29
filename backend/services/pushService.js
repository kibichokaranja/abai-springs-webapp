import webpush from 'web-push';

/**
 * Push notification service for sending push notifications
 */

// Configure web-push only if VAPID keys are available
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@abaisprings.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('VAPID keys not configured, push notifications disabled');
}

/**
 * Send push notification
 * @param {Object} options - Push notification options
 * @param {string} options.to - Recipient user ID or subscription endpoint
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Additional data payload
 * @param {Object} options.subscription - Push subscription object
 * @returns {Object} Send result
 */
export async function sendPushNotification(options) {
  try {
    const { to, title, body, data, subscription } = options;
    
    if (!title || !body) {
      throw new Error('Push notification title and body are required');
    }

    // If subscription object is provided, use it directly
    let pushSubscription = subscription;
    
    // If only user ID is provided, fetch subscription from database
    if (!pushSubscription && to) {
      pushSubscription = await getPushSubscription(to);
    }
    
    if (!pushSubscription) {
      throw new Error('No push subscription found for user');
    }

    const payload = JSON.stringify({
      title: title,
      body: body,
      icon: '/images/logo.png',
      badge: '/images/badge.png',
      data: data || {},
      actions: [
        {
          action: 'view',
          title: 'View Details'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    });

    const result = await webpush.sendNotification(pushSubscription, payload);
    
    console.log('Push notification sent successfully');
    
    return {
      success: true,
      message: 'Push notification sent successfully',
      status: result.statusCode
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    
    // Handle specific web-push errors
    if (error.statusCode === 410) {
      // Subscription is no longer valid, remove it
      await removePushSubscription(to);
      throw new Error('Push subscription is no longer valid and has been removed');
    }
    
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

/**
 * Send bulk push notifications
 * @param {Array} notificationList - Array of notification objects
 * @returns {Object} Bulk send result
 */
export async function sendBulkPushNotifications(notificationList) {
  const results = {
    total: notificationList.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const notificationData of notificationList) {
    try {
      await sendPushNotification(notificationData);
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        user: notificationData.to,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Send push notification with template
 * @param {string} template - Template name
 * @param {Object} data - Template data
 * @param {string} to - Recipient user ID
 * @returns {Object} Send result
 */
export async function sendTemplatePushNotification(template, data, to) {
  let title = '';
  let body = '';
  let notificationData = {};
  
  switch (template) {
    case 'welcome':
      title = 'Welcome to Abai Springs!';
      body = `Hello ${data.name}, welcome to our premium water delivery service!`;
      notificationData = { type: 'welcome', userId: data.userId };
      break;
    case 'order_confirmation':
      title = 'Order Confirmed!';
      body = `Your order #${data.orderId} has been confirmed. We'll notify you when it's ready.`;
      notificationData = { type: 'order', orderId: data.orderId };
      break;
    case 'delivery_update':
      title = 'Delivery Update';
      body = `Your order status: ${data.status}. ${data.message || ''}`;
      notificationData = { type: 'delivery', orderId: data.orderId, status: data.status };
      break;
    case 'stock_alert':
      title = 'Stock Alert';
      body = `${data.product} is running low at ${data.outlet}. Order now to avoid stockout!`;
      notificationData = { type: 'stock', product: data.product, outlet: data.outlet };
      break;
    case 'promotional':
      title = 'Special Offer!';
      body = `${data.message} Visit us at ${data.outlet || 'our nearest outlet'}!`;
      notificationData = { type: 'promotional', outlet: data.outlet };
      break;
    case 'payment_success':
      title = 'Payment Successful';
      body = `Your payment of ${data.amount} has been processed successfully.`;
      notificationData = { type: 'payment', amount: data.amount, orderId: data.orderId };
      break;
    case 'delivery_scheduled':
      title = 'Delivery Scheduled';
      body = `Your delivery is scheduled for ${data.deliveryDate} between ${data.timeSlot}.`;
      notificationData = { type: 'delivery', deliveryDate: data.deliveryDate, timeSlot: data.timeSlot };
      break;
    default:
      title = 'Abai Springs Notification';
      body = data.message || 'You have a new notification from Abai Springs';
      notificationData = { type: 'general' };
  }
  
  return await sendPushNotification({
    to,
    title,
    body,
    data: notificationData
  });
}

/**
 * Get push subscription for user
 * @param {string} userId - User ID
 * @returns {Object} Push subscription object
 */
async function getPushSubscription(userId) {
  // This would typically query a database to get the user's push subscription
  // For now, return null to indicate no subscription found
  console.log(`Fetching push subscription for user: ${userId}`);
  return null;
}

/**
 * Remove push subscription for user
 * @param {string} userId - User ID
 * @returns {boolean} Success status
 */
async function removePushSubscription(userId) {
  // This would typically remove the subscription from the database
  console.log(`Removing push subscription for user: ${userId}`);
  return true;
}

/**
 * Subscribe user to push notifications
 * @param {string} userId - User ID
 * @param {Object} subscription - Push subscription object
 * @returns {Object} Subscription result
 */
export async function subscribeToPushNotifications(userId, subscription) {
  try {
    // This would typically save the subscription to the database
    console.log(`Subscribing user ${userId} to push notifications`);
    
    return {
      success: true,
      message: 'Successfully subscribed to push notifications'
    };
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    throw new Error(`Failed to subscribe to push notifications: ${error.message}`);
  }
}

/**
 * Unsubscribe user from push notifications
 * @param {string} userId - User ID
 * @returns {Object} Unsubscription result
 */
export async function unsubscribeFromPushNotifications(userId) {
  try {
    // This would typically remove the subscription from the database
    console.log(`Unsubscribing user ${userId} from push notifications`);
    
    return {
      success: true,
      message: 'Successfully unsubscribed from push notifications'
    };
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    throw new Error(`Failed to unsubscribe from push notifications: ${error.message}`);
  }
}




