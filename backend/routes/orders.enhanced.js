import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateEnhanced, requirePermission } from '../middleware/authEnhanced.js';
import { asyncHandler } from '../middleware/validate.js';
import validate from '../middleware/validate.js';
import { orderRateLimit } from '../middleware/rateLimiting.js';
import EnhancedOrder from '../models/Order.enhanced.js';
import Subscription from '../models/Subscription.js';
import smartRoutingService from '../services/orderRouting/smartRoutingService.js';
import realTimeTrackingService from '../services/tracking/realTimeTrackingService.js';
import subscriptionService from '../services/subscriptionService.js';
import deliverySchedulingService from '../services/scheduling/deliverySchedulingService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ======================
// ENHANCED ORDER MANAGEMENT
// ======================

// @desc    Create enhanced order with advanced features
// @route   POST /api/orders/enhanced
// @access  Private
router.post('/', 
  authenticateEnhanced,
  orderRateLimit,
  [
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('outlet').optional().isMongoId().withMessage('Invalid outlet ID'),
    body('delivery.address').notEmpty().withMessage('Delivery address is required'),
    body('delivery.coordinates.lat').optional().isNumeric().withMessage('Invalid latitude'),
    body('delivery.coordinates.lng').optional().isNumeric().withMessage('Invalid longitude'),
    body('delivery.scheduledFor').optional().isISO8601().withMessage('Invalid scheduled date'),
    body('payment.method').isIn(['wallet', 'mpesa', 'paypal', 'stripe', 'cash_on_delivery']).withMessage('Invalid payment method'),
    body('flags.isUrgent').optional().isBoolean().withMessage('Invalid urgent flag'),
    body('routingAlgorithm').optional().isIn(['distance', 'availability', 'load_balancing', 'cost_optimization', 'customer_preference']).withMessage('Invalid routing algorithm')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const orderData = {
      ...req.body,
      customer: req.user._id,
      source: {
        platform: 'web',
        userAgent: req.get('user-agent'),
        ipAddress: req.ip
      }
    };

    // Create enhanced order
    const order = new EnhancedOrder(orderData);
    await order.save();

    // Route the order
    const routingAlgorithm = req.body.routingAlgorithm || 'distance';
    const routingResult = await smartRoutingService.routeOrder(order._id, routingAlgorithm);

    // Update order with routing results
    if (routingResult.outlet) {
      order.outlet = routingResult.outlet._id;
      order.business.assignedOutlet = routingResult.outlet._id;
    }

    if (routingResult.driver) {
      await order.assignDriver(
        routingResult.driver._id,
        null, // System assignment
        routingResult.metrics.estimatedDeliveryTime
      );
    }

    order.business.estimatedDeliveryTime = routingResult.metrics.estimatedDeliveryTime;
    await order.save();

    logger.info('Enhanced order created', {
      orderId: order._id,
      customerId: req.user._id,
      routingAlgorithm: routingAlgorithm,
      assignedOutlet: routingResult.outlet?._id,
      assignedDriver: routingResult.driver?._id
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: order,
        routing: routingResult
      }
    });
  })
);

// @desc    Get order with real-time tracking
// @route   GET /api/orders/enhanced/:orderId/track
// @access  Private
router.get('/:orderId/track',
  authenticateEnhanced,
  [
    param('orderId').isMongoId().withMessage('Invalid order ID')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    
    const order = await EnhancedOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (order.customer.toString() !== req.user._id.toString() && 
        !req.user.permissions?.orders?.read) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    const trackingData = await realTimeTrackingService.getOrderTracking(orderId);

    res.json({
      success: true,
      message: 'Order tracking data retrieved',
      data: trackingData
    });
  })
);

// @desc    Update order status
// @route   PUT /api/orders/enhanced/:orderId/status
// @access  Private (Staff/Driver)
router.put('/:orderId/status',
  authenticateEnhanced,
  requirePermission('orders', 'update'),
  [
    param('orderId').isMongoId().withMessage('Invalid order ID'),
    body('status').isIn(['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'at_location', 'delivered', 'failed_delivery', 'cancelled']).withMessage('Invalid status'),
    body('notes').optional().isString().withMessage('Notes must be a string'),
    body('location.lat').optional().isNumeric().withMessage('Invalid latitude'),
    body('location.lng').optional().isNumeric().withMessage('Invalid longitude')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status, notes, location } = req.body;

    await realTimeTrackingService.updateOrderStatus(orderId, status, notes, req.user._id);

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });
  })
);

// ======================
// SUBSCRIPTION MANAGEMENT
// ======================

// @desc    Create subscription
// @route   POST /api/orders/enhanced/subscriptions
// @access  Private
router.post('/subscriptions',
  authenticateEnhanced,
  [
    body('name').notEmpty().withMessage('Subscription name is required'),
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('schedule.frequency').isIn(['daily', 'weekly', 'biweekly', 'monthly', 'custom']).withMessage('Invalid frequency'),
    body('delivery.address').notEmpty().withMessage('Delivery address is required'),
    body('payment.method').isIn(['wallet', 'mpesa', 'paypal', 'stripe']).withMessage('Invalid payment method'),
    body('startDate').optional().isISO8601().withMessage('Invalid start date')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const subscriptionData = {
      ...req.body,
      customerId: req.user._id
    };

    const result = await subscriptionService.createSubscription(subscriptionData);

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: result
    });
  })
);

// @desc    Get customer subscriptions
// @route   GET /api/orders/enhanced/subscriptions
// @access  Private
router.get('/subscriptions',
  authenticateEnhanced,
  [
    query('status').optional().isIn(['active', 'paused', 'cancelled', 'expired']).withMessage('Invalid status filter')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    
    const result = await subscriptionService.getCustomerSubscriptions(req.user._id, status);

    res.json({
      success: true,
      message: 'Subscriptions retrieved successfully',
      data: result
    });
  })
);

// @desc    Get subscription details
// @route   GET /api/orders/enhanced/subscriptions/:subscriptionId
// @access  Private
router.get('/subscriptions/:subscriptionId',
  authenticateEnhanced,
  [
    param('subscriptionId').isMongoId().withMessage('Invalid subscription ID')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { subscriptionId } = req.params;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Check authorization
    if (subscription.customer.toString() !== req.user._id.toString() && 
        !req.user.permissions?.subscriptions?.read) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this subscription'
      });
    }

    const result = await subscriptionService.getSubscriptionDetails(subscriptionId);

    res.json({
      success: true,
      message: 'Subscription details retrieved',
      data: result
    });
  })
);

// @desc    Update subscription
// @route   PUT /api/orders/enhanced/subscriptions/:subscriptionId
// @access  Private
router.put('/subscriptions/:subscriptionId',
  authenticateEnhanced,
  [
    param('subscriptionId').isMongoId().withMessage('Invalid subscription ID'),
    body('items').optional().isArray().withMessage('Items must be an array'),
    body('schedule').optional().isObject().withMessage('Schedule must be an object'),
    body('delivery').optional().isObject().withMessage('Delivery must be an object'),
    body('preferences').optional().isObject().withMessage('Preferences must be an object')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { subscriptionId } = req.params;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (subscription.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this subscription'
      });
    }

    const result = await subscriptionService.updateSubscription(subscriptionId, req.body, req.user._id);

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: result
    });
  })
);

// @desc    Pause subscription
// @route   PUT /api/orders/enhanced/subscriptions/:subscriptionId/pause
// @access  Private
router.put('/subscriptions/:subscriptionId/pause',
  authenticateEnhanced,
  [
    param('subscriptionId').isMongoId().withMessage('Invalid subscription ID'),
    body('reason').notEmpty().withMessage('Pause reason is required'),
    body('pauseUntil').optional().isISO8601().withMessage('Invalid pause until date')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { subscriptionId } = req.params;
    const { reason, pauseUntil } = req.body;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || subscription.customer.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const result = await subscriptionService.pauseSubscription(subscriptionId, reason, pauseUntil, req.user._id);

    res.json({
      success: true,
      message: 'Subscription paused successfully',
      data: result
    });
  })
);

// @desc    Resume subscription
// @route   PUT /api/orders/enhanced/subscriptions/:subscriptionId/resume
// @access  Private
router.put('/subscriptions/:subscriptionId/resume',
  authenticateEnhanced,
  [
    param('subscriptionId').isMongoId().withMessage('Invalid subscription ID')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { subscriptionId } = req.params;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || subscription.customer.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const result = await subscriptionService.resumeSubscription(subscriptionId, req.user._id);

    res.json({
      success: true,
      message: 'Subscription resumed successfully',
      data: result
    });
  })
);

// @desc    Cancel subscription
// @route   DELETE /api/orders/enhanced/subscriptions/:subscriptionId
// @access  Private
router.delete('/subscriptions/:subscriptionId',
  authenticateEnhanced,
  [
    param('subscriptionId').isMongoId().withMessage('Invalid subscription ID'),
    body('reason').notEmpty().withMessage('Cancellation reason is required'),
    body('requestRefund').optional().isBoolean().withMessage('Request refund must be boolean')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { subscriptionId } = req.params;
    const { reason, requestRefund = false } = req.body;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || subscription.customer.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const result = await subscriptionService.cancelSubscription(subscriptionId, reason, req.user._id, requestRefund);

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: result
    });
  })
);

// ======================
// SCHEDULING & DELIVERY WINDOWS
// ======================

// @desc    Get available delivery slots
// @route   GET /api/orders/enhanced/scheduling/slots
// @access  Private
router.get('/scheduling/slots',
  authenticateEnhanced,
  [
    query('date').isISO8601().withMessage('Valid date is required'),
    query('outletId').optional().isMongoId().withMessage('Invalid outlet ID'),
    query('lat').optional().isNumeric().withMessage('Invalid latitude'),
    query('lng').optional().isNumeric().withMessage('Invalid longitude')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { date, outletId, lat, lng } = req.query;
    
    const coordinates = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    const slots = await deliverySchedulingService.getAvailableSlots(date, coordinates, outletId);

    res.json({
      success: true,
      message: 'Available delivery slots retrieved',
      data: {
        date: date,
        slots: slots
      }
    });
  })
);

// @desc    Schedule order for specific time slot
// @route   PUT /api/orders/enhanced/:orderId/schedule
// @access  Private
router.put('/:orderId/schedule',
  authenticateEnhanced,
  [
    param('orderId').isMongoId().withMessage('Invalid order ID'),
    body('scheduledDate').isISO8601().withMessage('Valid scheduled date is required'),
    body('timeSlot').notEmpty().withMessage('Time slot is required'),
    body('preferences').optional().isObject().withMessage('Preferences must be an object')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { scheduledDate, timeSlot, preferences } = req.body;

    const order = await EnhancedOrder.findById(orderId);
    if (!order || order.customer.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const result = await deliverySchedulingService.scheduleOrder(orderId, scheduledDate, timeSlot, preferences);

    res.json({
      success: true,
      message: 'Order scheduled successfully',
      data: result
    });
  })
);

// @desc    Get delivery routes (Admin)
// @route   GET /api/orders/enhanced/scheduling/routes
// @access  Private (Admin)
router.get('/scheduling/routes',
  authenticateEnhanced,
  requirePermission('orders', 'read'),
  [
    query('date').isISO8601().withMessage('Valid date is required'),
    query('timeSlot').optional().isString().withMessage('Invalid time slot'),
    query('outletId').optional().isMongoId().withMessage('Invalid outlet ID')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { date, timeSlot, outletId } = req.query;
    
    const routes = await deliverySchedulingService.getDeliveryRoutes(date, timeSlot, outletId);

    res.json({
      success: true,
      message: 'Delivery routes retrieved',
      data: routes
    });
  })
);

// ======================
// ANALYTICS & REPORTING
// ======================

// @desc    Get order analytics
// @route   GET /api/orders/enhanced/analytics
// @access  Private (Admin)
router.get('/analytics',
  authenticateEnhanced,
  requirePermission('analytics', 'read'),
  [
    query('timeRange').optional().isIn(['24h', '7d', '30d', '90d']).withMessage('Invalid time range'),
    query('outletId').optional().isMongoId().withMessage('Invalid outlet ID'),
    query('metric').optional().isIn(['orders', 'revenue', 'delivery_time', 'customer_satisfaction']).withMessage('Invalid metric')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { timeRange = '30d', outletId, metric } = req.query;
    
    const startDate = new Date();
    if (timeRange === '24h') {
      startDate.setHours(startDate.getHours() - 24);
    } else if (timeRange === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (timeRange === '90d') {
      startDate.setDate(startDate.getDate() - 90);
    }

    const endDate = new Date();

    const analytics = await EnhancedOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          ...(outletId && { outlet: outletId })
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status.current'
          },
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
          avgDeliveryTime: { $avg: '$business.actualDeliveryTime' },
          avgRating: { $avg: '$feedback.rating' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    res.json({
      success: true,
      message: 'Order analytics retrieved',
      data: {
        timeRange: timeRange,
        analytics: analytics,
        summary: {
          totalOrders: analytics.reduce((sum, item) => sum + item.count, 0),
          totalRevenue: analytics.reduce((sum, item) => sum + item.revenue, 0),
          averageDeliveryTime: analytics.length > 0 ? 
            analytics.reduce((sum, item) => sum + (item.avgDeliveryTime || 0), 0) / analytics.length : 0,
          averageRating: analytics.filter(item => item.avgRating).length > 0 ?
            analytics.reduce((sum, item) => sum + (item.avgRating || 0), 0) / analytics.filter(item => item.avgRating).length : 0
        }
      }
    });
  })
);

// @desc    Get subscription analytics
// @route   GET /api/orders/enhanced/subscriptions/analytics
// @access  Private (Admin)
router.get('/subscriptions/analytics',
  authenticateEnhanced,
  requirePermission('analytics', 'read'),
  [
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Invalid time range')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { timeRange = '30d' } = req.query;
    
    const analytics = await subscriptionService.getSubscriptionAnalytics(timeRange);

    res.json({
      success: true,
      message: 'Subscription analytics retrieved',
      data: analytics
    });
  })
);

// @desc    Get scheduling analytics
// @route   GET /api/orders/enhanced/scheduling/analytics
// @access  Private (Admin)
router.get('/scheduling/analytics',
  authenticateEnhanced,
  requirePermission('analytics', 'read'),
  [
    query('startDate').isISO8601().withMessage('Valid start date is required'),
    query('endDate').isISO8601().withMessage('Valid end date is required')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    const analytics = await deliverySchedulingService.getSchedulingAnalytics(startDate, endDate);

    res.json({
      success: true,
      message: 'Scheduling analytics retrieved',
      data: analytics
    });
  })
);

// ======================
// ADMIN OPERATIONS
// ======================

// @desc    Process subscription orders manually
// @route   POST /api/orders/enhanced/subscriptions/process
// @access  Private (Admin)
router.post('/subscriptions/process',
  authenticateEnhanced,
  requirePermission('subscriptions', 'create'),
  asyncHandler(async (req, res) => {
    const result = await subscriptionService.processSubscriptionOrders();

    logger.info('Manual subscription processing triggered', {
      adminId: req.user._id,
      result: result
    });

    res.json({
      success: true,
      message: 'Subscription orders processed',
      data: result
    });
  })
);

// @desc    Get routing analytics
// @route   GET /api/orders/enhanced/routing/analytics
// @access  Private (Admin)
router.get('/routing/analytics',
  authenticateEnhanced,
  requirePermission('analytics', 'read'),
  [
    query('timeRange').optional().isIn(['24h', '7d', '30d']).withMessage('Invalid time range')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    
    const analytics = await smartRoutingService.getRoutingAnalytics(timeRange);

    res.json({
      success: true,
      message: 'Routing analytics retrieved',
      data: analytics
    });
  })
);

export default router;


