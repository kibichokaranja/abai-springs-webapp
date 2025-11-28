import express from 'express';
import staffNotificationService from '../services/staffNotificationService.js';
import { authenticateToken } from '../middleware/auth.js';
import winston from 'winston';

const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Send daily owner insights
router.post('/owner/daily-insights', authenticateToken, async (req, res) => {
  try {
    logger.info('API: Sending daily owner insights', { userId: req.user?.id });
    
    const result = await staffNotificationService.sendDailyOwnerInsights();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Daily owner insights sent successfully',
        data: result.results
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send daily owner insights',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('API Error: Failed to send daily owner insights', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Send delivery assignment to driver
router.post('/driver/delivery-assignment', authenticateToken, async (req, res) => {
  try {
    const { orderId, driverId, orderData } = req.body;
    
    if (!driverId || !orderData) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID and order data are required'
      });
    }

    logger.info('API: Sending delivery assignment', { orderId, driverId });
    
    const result = await staffNotificationService.sendDeliveryAssignment(orderData, driverId);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Delivery assignment sent successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send delivery assignment',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('API Error: Failed to send delivery assignment', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Send sales lead notification
router.post('/sales/lead-notification', authenticateToken, async (req, res) => {
  try {
    const { salespersonId, leadData } = req.body;
    
    if (!salespersonId || !leadData) {
      return res.status(400).json({
        success: false,
        message: 'Salesperson ID and lead data are required'
      });
    }

    logger.info('API: Sending sales lead notification', { salespersonId });
    
    const result = await staffNotificationService.sendSalesLeadNotification(leadData, salespersonId);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Sales lead notification sent successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send sales lead notification',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('API Error: Failed to send sales lead notification', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Send warehouse inventory alert
router.post('/warehouse/inventory-alert', authenticateToken, async (req, res) => {
  try {
    const { alertType, items, priority } = req.body;
    
    if (!alertType || !items) {
      return res.status(400).json({
        success: false,
        message: 'Alert type and items are required'
      });
    }

    logger.info('API: Sending warehouse inventory alert', { alertType, priority });
    
    const result = await staffNotificationService.sendWarehouseInventoryAlert(alertType, items, priority);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Warehouse inventory alert sent successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send warehouse inventory alert',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('API Error: Failed to send warehouse inventory alert', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Trigger notification by event type
router.post('/trigger/:eventType', authenticateToken, async (req, res) => {
  try {
    const { eventType } = req.params;
    const eventData = req.body;

    logger.info('API: Triggering notification by event', { eventType });
    
    const result = await staffNotificationService.triggerNotification(eventType, eventData);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: `Notification triggered successfully for event: ${eventType}`,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Failed to trigger notification for event: ${eventType}`,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('API Error: Failed to trigger notification', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Schedule daily owner insights
router.post('/schedule/daily-insights', authenticateToken, async (req, res) => {
  try {
    logger.info('API: Scheduling daily owner insights');
    
    staffNotificationService.scheduleDailyOwnerInsights();
    
    res.status(200).json({
      success: true,
      message: 'Daily owner insights scheduled successfully'
    });
  } catch (error) {
    logger.error('API Error: Failed to schedule daily insights', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Cancel scheduled notifications
router.delete('/schedule/cancel', authenticateToken, async (req, res) => {
  try {
    logger.info('API: Cancelling scheduled notifications');
    
    staffNotificationService.cancelScheduledNotifications();
    
    res.status(200).json({
      success: true,
      message: 'Scheduled notifications cancelled successfully'
    });
  } catch (error) {
    logger.error('API Error: Failed to cancel scheduled notifications', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get notification status and info
router.get('/status', authenticateToken, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Staff notification system is active',
      data: {
        system: 'Staff Email Notification System',
        version: '1.0.0',
        features: [
          'Owner Daily Insights',
          'Driver Delivery Assignments',
          'Sales Lead Notifications',
          'Warehouse Inventory Alerts'
        ],
        status: 'operational'
      }
    });
  } catch (error) {
    logger.error('API Error: Failed to get notification status', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;




































