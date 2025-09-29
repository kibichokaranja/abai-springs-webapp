import express from 'express';
import jwt from 'jsonwebtoken';
import { body, param, query } from 'express-validator';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import OutletInventory from '../models/OutletInventory.js';
import notificationService from '../services/notificationService.js';
import { asyncHandler, ApiError, default as validate } from '../middleware/validate.js';
import { 
  sendListResponse, 
  sendItemResponse, 
  sendCreated, 
  sendUpdated, 
  sendDeleted,
  sendNotFound,
  sendConflict
} from '../utils/responseHandler.js';
import { cacheOrders, cacheOrder, invalidateOrders, invalidateOrder } from '../middleware/cache.js';
import { orderRateLimit } from '../middleware/rateLimiting.js';

const router = express.Router();

// Validation rules
const validateOrderId = [
  param('id').isMongoId().withMessage('Invalid order ID format')
];

const validateOrderData = [
  body('customerName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Customer name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please enter a valid email address'),
  body('phone')
    .trim()
    .matches(/^(\+254|0)?[0-9]\d{8}$/)
    .withMessage('Please enter a valid Kenyan phone number'),
  body('address')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  body('city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  body('outletId')
    .optional()
    .isMongoId()
    .withMessage('Invalid outlet ID format'),
  body('deliveryOption')
    .optional()
    .isIn(['standard', 'express', 'same-day'])
    .withMessage('Invalid delivery option'),
  body('paymentMethod')
    .optional()
    .isIn(['mpesa', 'card', 'cash_on_delivery'])
    .withMessage('Invalid payment method'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.qty')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('items.*.price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('totalAmount')
    .isFloat({ min: 0 })
    .withMessage('Total amount must be a positive number')
];

const validateQueryParams = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid status filter')
];

// @desc    Get all orders
// @route   GET /api/orders
// @access  Public (temporarily for dashboard testing)
router.get('/', validateQueryParams, cacheOrders, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  
  const query = {};
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;
  const orders = await Order.find(query)
    .populate('items.product')
    .populate('outlet')
    .populate('customer', 'name email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Order.countDocuments(query);

  return sendListResponse(res, orders, page, limit, total, 'Orders retrieved successfully');
}));

// @desc    Create new order
// @route   POST /api/orders
// @access  Public (temporarily for testing)
router.post('/', orderRateLimit, validateOrderData, validate, asyncHandler(async (req, res) => {
  console.log('📦 Order creation request received:', {
    body: req.body,
    headers: req.headers
  });

  // Temporarily bypass authentication for testing
  let user = null;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.id);
    } catch (error) {
      // Continue without user for testing
    }
  }

  const {
    customerName,
    email,
    phone,
    address,
    city,
    postalCode,
    deliveryOption,
    paymentMethod,
    orderNotes,
    items,
    totalAmount,
    outletId
  } = req.body;

  // Verify outlet exists if provided
  let outlet = null;
  if (outletId) {
    outlet = await Outlet.findById(outletId);
    if (!outlet) {
      throw new ApiError('Selected outlet not found', 404);
    }
  }

  // Check stock availability for each item if outlet is specified
  if (outlet) {
    for (const item of items) {
      const productId = item._id || item.id;
      const quantity = item.qty;
      
      // First check outlet-specific inventory
      const stockCheck = await OutletInventory.checkStock(outletId, productId, quantity);
      
      if (!stockCheck.available) {
        // If outlet inventory doesn't exist or is insufficient, check main product stock
        const product = await Product.findById(productId);
        if (!product) {
          throw new ApiError(`Product ${item.name || 'product'} not found`, 400);
        }
        
        if (product.stockLevel < quantity) {
          throw new ApiError(`Insufficient stock for ${item.name || 'product'}. Available: ${product.stockLevel}, Requested: ${quantity}`, 400);
        }
        
        console.log(`⚠️ Using main product stock for ${item.name}: ${product.stockLevel} units (outlet inventory not found)`);
      } else {
        console.log(`✅ Outlet inventory check passed for ${item.name}: ${stockCheck.availableStock} units available`);
      }
    }
  }

  // Calculate delivery fee based on option
  let deliveryFee = 0;
  switch (deliveryOption) {
    case 'express':
      deliveryFee = 500;
      break;
    case 'same-day':
      deliveryFee = 1000;
      break;
    default:
      deliveryFee = 0;
  }

  // Validate items array
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError('Items array is required and must contain at least one item', 400);
  }

  // Create order items structure
  const orderItems = items.map(item => ({
    product: item._id || item.id, // Handle both cases
    quantity: item.qty,
    price: item.price,
    total: item.price * item.qty
  }));

  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

      // Create order object
    const orderData = {
      customer: user?._id || null,
      customerName: customerName, // Add customer name as separate field
      customerEmail: email, // Add customer email as separate field
      customerPhone: phone, // Add customer phone as separate field
      outlet: outlet?._id || null, // Use specified outlet or null
      items: orderItems,
      subtotal,
      deliveryFee,
      totalAmount: totalAmount || (subtotal + deliveryFee),
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: paymentMethod || 'mpesa',
      paymentTiming: req.body.paymentTiming || 'now', // Add payment timing
      deliveryAddress: {
        type: 'home',
        address: `${address}, ${city}, ${postalCode}`
      },
      deliveryInstructions: orderNotes || '',
      notes: `Customer: ${customerName}, Email: ${email || 'Not provided'}, Phone: ${phone}`
    };

  const order = new Order(orderData);
  await order.save();

  // Reserve stock for each item if outlet is specified
  if (outlet) {
    for (const item of items) {
      const productId = item._id || item.id;
      const quantity = item.qty;
      
      try {
        // Try to reserve outlet-specific stock first
        try {
          await OutletInventory.reserveStock(outletId, productId, quantity);
          console.log(`✅ Reserved outlet stock for ${item.name}: ${quantity} units`);
          
          // After reserving, check low stock threshold and notify staff if needed
          const inventory = await OutletInventory.findOne({ outlet: outletId, product: productId, isActive: true });
          if (inventory && (inventory.availableStock <= inventory.lowStockThreshold)) {
            const [prodDoc, outletDoc] = await Promise.all([
              Product.findById(productId),
              Outlet.findById(outletId)
            ]);
            // Fire and forget; no need to block the response - only if function exists
            if (notificationService && typeof notificationService.sendStaffLowStock === 'function') {
              notificationService.sendStaffLowStock(outletDoc, prodDoc, inventory).catch(() => {});
            }
          }
        } catch (outletError) {
          // If outlet inventory doesn't exist, reduce main product stock
          console.log(`⚠️ Outlet inventory not found for ${item.name}, using main product stock`);
          const product = await Product.findById(productId);
          if (product && product.stockLevel >= quantity) {
            product.stockLevel -= quantity;
            await product.save();
            console.log(`✅ Reduced main product stock for ${item.name}: ${product.stockLevel} units remaining`);
          } else {
            throw new Error(`Insufficient main product stock for ${item.name}`);
          }
        }
      } catch (error) {
        // If stock reservation fails, delete the order and throw error
        await Order.findByIdAndDelete(order._id);
        throw new ApiError(`Failed to reserve stock: ${error.message}`, 400);
      }
    }
  }

  // Populate the order for response
  const populatedOrder = await Order.findById(order._id)
    .populate('items.product')
    .populate('outlet')
    .populate('customer', 'name email');

  // Send customer thank-you (non-blocking) - only if function exists
  if (notificationService && typeof notificationService.sendCustomerThankYou === 'function') {
    notificationService.sendCustomerThankYou(populatedOrder).catch(() => {});
  }

  // 🚨 SMART STOCK ALERT SYSTEM - Check stock levels after order
  if (notificationService && typeof notificationService.checkStockLevels === 'function') {
    notificationService.checkStockLevels(populatedOrder).catch(() => {});
  }

  return sendCreated(res, populatedOrder, 'Order created successfully');
}));

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Public (temporarily for dashboard testing)
router.get('/:id', validateOrderId, cacheOrder, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('items.product')
    .populate('outlet')
    .populate('customer', 'name email phone');
    
  if (!order) {
    return sendNotFound(res, 'Order', req.params.id);
  }
  
  return sendItemResponse(res, order, 'Order retrieved successfully');
}));

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Public (temporarily for dashboard testing)
router.put('/:id', validateOrderId, invalidateOrder, asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id, 
    req.body, 
    { new: true, runValidators: true }
  );
  
  if (!order) {
    return sendNotFound(res, 'Order', req.params.id);
  }
  
  return sendUpdated(res, order, 'Order updated successfully');
}));

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Public (temporarily for dashboard testing)
router.delete('/:id', validateOrderId, invalidateOrder, asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  
  if (!order) {
    return sendNotFound(res, 'Order', req.params.id);
  }
  
  return sendDeleted(res, 'Order deleted successfully');
}));

// @desc    Track order by phone number
// @route   GET /api/orders/track/phone/:phone
// @access  Public
router.get('/track/phone/:phone', asyncHandler(async (req, res) => {
  const { phone } = req.params;
  
  // Clean phone number (remove spaces, dashes, etc.)
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Find orders by phone number (assuming phone is stored in notes or customer info)
  const orders = await Order.find({
    $or: [
      { 'notes': { $regex: cleanPhone, $options: 'i' } },
      { 'customerName': { $regex: cleanPhone, $options: 'i' } }
    ]
  })
  .populate('items.product')
  .populate('outlet')
  .populate('customer', 'name email phone')
  .sort({ createdAt: -1 })
  .limit(10); // Limit to 10 most recent orders

  if (orders.length === 0) {
    return sendNotFound(res, 'Orders', `for phone number ${phone}`);
  }

  return sendListResponse(res, orders, 1, 10, orders.length, 'Orders found successfully');
}));

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Public (temporarily for testing)
router.put('/:id/status', validateOrderId, asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required'
    });
  }

  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { 
      status,
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  )
  .populate('items.product')
  .populate('outlet')
  .populate('customer', 'name email phone');
  
  if (!order) {
    return sendNotFound(res, 'Order', req.params.id);
  }
  
  return sendUpdated(res, order, 'Order status updated successfully');
}));

export default router; 