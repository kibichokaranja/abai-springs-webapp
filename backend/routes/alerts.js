import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/validate.js';
import { 
  sendListResponse, 
  sendItemResponse, 
  sendCreated, 
  sendUpdated, 
  sendDeleted,
  sendNotFound
} from '../utils/responseHandler.js';
import { sendAlertNotification } from '../services/alertService.js';

const router = express.Router();

// Validation rules
const validateAlertId = [
  param('id').isMongoId().withMessage('Invalid alert ID format')
];

const validateSendAlert = [
  body('type')
    .isIn(['stock_low', 'stock_critical', 'custom', 'promotional', 'delivery'])
    .withMessage('Invalid alert type'),
  body('customer')
    .notEmpty()
    .withMessage('Customer is required'),
  body('outlet')
    .notEmpty()
    .withMessage('Outlet is required'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters'),
  body('deliveryMethods')
    .isArray({ min: 1 })
    .withMessage('At least one delivery method is required'),
  body('deliveryMethods.*')
    .isIn(['email', 'sms', 'push'])
    .withMessage('Invalid delivery method'),
  body('priority')
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),
  body('schedule')
    .isIn(['immediate', 'scheduled'])
    .withMessage('Invalid schedule option')
];

// @desc    Send alert
// @route   POST /api/alerts/send
// @access  Private (Admin)
router.post('/send', authenticate, authorize(['admin']), validateSendAlert, asyncHandler(async (req, res) => {
  const {
    type,
    customer,
    product,
    outlet,
    message,
    deliveryMethods,
    priority,
    schedule,
    scheduleTime
  } = req.body;

  // Validate schedule time if scheduled
  if (schedule === 'scheduled' && !scheduleTime) {
    throw new ApiError('Schedule time is required for scheduled alerts', 400);
  }

  // Create alert data
  const alertData = {
    type,
    customer,
    product: product || null,
    outlet,
    message,
    deliveryMethods,
    priority,
    schedule,
    scheduleTime: schedule === 'scheduled' ? new Date(scheduleTime) : null,
    sentBy: req.user._id,
    status: schedule === 'immediate' ? 'pending' : 'scheduled'
  };

  try {
    // Send the alert
    const result = await sendAlertNotification(alertData);
    
    return sendCreated(res, result, 'Alert sent successfully');
  } catch (error) {
    console.error('Error sending alert:', error);
    throw new ApiError('Failed to send alert', 500);
  }
}));

// @desc    Get alert history
// @route   GET /api/alerts
// @access  Private (Admin)
router.get('/', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type, status, priority } = req.query;
  
  // Build query
  const query = {};
  if (type) query.type = type;
  if (status) query.status = status;
  if (priority) query.priority = priority;

  const skip = (page - 1) * limit;
  
  // This would typically query an Alert model
  // For now, return a mock response
  const alerts = [];
  const total = 0;

  return sendListResponse(res, alerts, page, limit, total, 'Alerts retrieved successfully');
}));

// @desc    Get alert by ID
// @route   GET /api/alerts/:id
// @access  Private (Admin)
router.get('/:id', authenticate, authorize(['admin']), validateAlertId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // This would typically query an Alert model
  // For now, return a mock response
  return sendNotFound(res, 'Alert not found');
}));

// @desc    Update alert status
// @route   PUT /api/alerts/:id/status
// @access  Private (Admin)
router.put('/:id/status', authenticate, authorize(['admin']), validateAlertId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'sent', 'failed', 'cancelled'].includes(status)) {
    throw new ApiError('Invalid status', 400);
  }

  // This would typically update an Alert model
  // For now, return a mock response
  return sendUpdated(res, { id, status }, 'Alert status updated successfully');
}));

// @desc    Cancel scheduled alert
// @route   DELETE /api/alerts/:id
// @access  Private (Admin)
router.delete('/:id', authenticate, authorize(['admin']), validateAlertId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // This would typically cancel a scheduled alert
  // For now, return a mock response
  return sendDeleted(res, 'Alert cancelled successfully');
}));

export default router;















































