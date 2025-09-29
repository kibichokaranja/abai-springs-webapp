import express from 'express';
import Newsletter from '../models/Newsletter.js';
import { asyncHandler } from '../middleware/validate.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

const router = express.Router();

// Subscribe to newsletter
router.post('/subscribe', asyncHandler(async (req, res) => {
  const { email, name, phone, preferences = {} } = req.body;

  // Check if already subscribed
  const existingSubscriber = await Newsletter.findOne({ email: email.toLowerCase() });
  
  if (existingSubscriber) {
    if (existingSubscriber.isActive) {
      return sendError(res, 'Email already subscribed to newsletter', 400);
    } else {
      // Reactivate subscription
      existingSubscriber.isActive = true;
      existingSubscriber.name = name || existingSubscriber.name;
      existingSubscriber.phone = phone || existingSubscriber.phone;
      existingSubscriber.preferences = { ...existingSubscriber.preferences, ...preferences };
      await existingSubscriber.save();
      
      return sendSuccess(res, {
        message: 'Newsletter subscription reactivated successfully',
        data: existingSubscriber
      });
    }
  }

  // Create new subscription
  const newsletter = new Newsletter({
    email: email.toLowerCase(),
    name,
    phone,
    preferences: {
      emailUpdates: true,
      whatsappUpdates: preferences.whatsappUpdates || false,
      promotions: preferences.promotions !== false,
      productUpdates: preferences.productUpdates !== false,
      deliveryUpdates: preferences.deliveryUpdates !== false
    }
  });

  await newsletter.save();

  return sendSuccess(res, {
    message: 'Successfully subscribed to newsletter',
    data: newsletter
  }, 201);
}));

// Unsubscribe from newsletter
router.post('/unsubscribe', asyncHandler(async (req, res) => {
  const { email } = req.body;

  const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });
  
  if (!subscriber) {
    return sendError(res, 'Email not found in newsletter subscriptions', 404);
  }

  await subscriber.unsubscribe();

  return sendSuccess(res, {
    message: 'Successfully unsubscribed from newsletter'
  });
}));

// Update subscription preferences
router.put('/preferences', asyncHandler(async (req, res) => {
  const { email, preferences } = req.body;

  const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });
  
  if (!subscriber) {
    return sendError(res, 'Email not found in newsletter subscriptions', 404);
  }

  await subscriber.updatePreferences(preferences);

  return sendSuccess(res, {
    message: 'Subscription preferences updated successfully',
    data: subscriber
  });
}));

// Get all subscribers (admin only)
router.get('/subscribers', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, source } = req.query;
  
  const query = {};
  if (status) query.status = status;
  if (source) query.source = source;

  const subscribers = await Newsletter.find(query)
    .sort({ subscribedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await Newsletter.countDocuments(query);

  return sendSuccess(res, {
    message: 'Subscribers retrieved successfully',
    data: {
      subscribers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalSubscribers: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    }
  });
}));

// Get subscription statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const totalSubscribers = await Newsletter.countDocuments({ isActive: true });
  const emailSubscribers = await Newsletter.countDocuments({ 
    isActive: true, 
    'preferences.emailUpdates': true 
  });
  const whatsappSubscribers = await Newsletter.countDocuments({ 
    isActive: true, 
    'preferences.whatsappUpdates': true 
  });
  const newThisMonth = await Newsletter.countDocuments({
    isActive: true,
    subscribedAt: { 
      $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
    }
  });

  return sendSuccess(res, {
    message: 'Newsletter statistics retrieved successfully',
    data: {
      totalSubscribers,
      emailSubscribers,
      whatsappSubscribers,
      newThisMonth,
      activeSubscribers: totalSubscribers
    }
  });
}));

// Get subscribers for email campaigns
router.get('/email-subscribers', asyncHandler(async (req, res) => {
  const subscribers = await Newsletter.getEmailSubscribers();
  
  return sendSuccess(res, {
    message: 'Email subscribers retrieved successfully',
    data: subscribers
  });
}));

// Get subscribers for WhatsApp campaigns
router.get('/whatsapp-subscribers', asyncHandler(async (req, res) => {
  const subscribers = await Newsletter.getWhatsappSubscribers();
  
  return sendSuccess(res, {
    message: 'WhatsApp subscribers retrieved successfully',
    data: subscribers
  });
}));

export default router;











