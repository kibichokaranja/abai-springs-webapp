import express from 'express';
import { body, param, query } from 'express-validator';
import SupplierOrder from '../models/SupplierOrder.js';
import Supplier from '../models/Supplier.js';
import WarehouseInventory from '../models/WarehouseInventory.js';
import Staff from '../models/Staff.js';
import { asyncHandler, ApiError, default as validate } from '../middleware/validate.js';
import { 
  sendListResponse, 
  sendItemResponse, 
  sendCreated, 
  sendUpdated, 
  sendDeleted,
  sendNotFound
} from '../utils/responseHandler.js';

const router = express.Router();

// Validation rules
const validateOrderId = [
  param('id').isMongoId().withMessage('Invalid order ID format')
];

const validateOrderData = [
  body('supplier')
    .isMongoId()
    .withMessage('Valid supplier ID is required'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.itemType')
    .isIn(['bottles', 'bottle_tops', 'branding', 'labels', 'packaging', 'other'])
    .withMessage('Invalid item type'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),
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
    .withMessage('Limit must be between 1 and 100')
];

// @desc    Get all supplier orders
// @route   GET /api/supplier-orders
// @access  Public (temporarily for dashboard testing)
router.get('/', validateQueryParams, asyncHandler(async (req, res) => {
  const { status, supplier, page = 1, limit = 20 } = req.query;

  const query = {};

  if (status) {
    query.status = status;
  }

  if (supplier) {
    query.supplier = supplier;
  }

  const skip = (page - 1) * limit;
  const orders = await SupplierOrder.find(query)
    .populate('supplier', 'name email phone')
    .populate('orderedBy', 'name email')
    .populate('receivedBy', 'name email')
    .sort({ orderDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await SupplierOrder.countDocuments(query);

  return sendListResponse(res, orders, page, limit, total, 'Supplier orders retrieved successfully');
}));

// @desc    Get single supplier order
// @route   GET /api/supplier-orders/:id
// @access  Public
router.get('/:id', validateOrderId, asyncHandler(async (req, res) => {
  const order = await SupplierOrder.findById(req.params.id)
    .populate('supplier')
    .populate('orderedBy', 'name email')
    .populate('receivedBy', 'name email');

  if (!order) {
    return sendNotFound(res, 'Supplier order', req.params.id);
  }

  return sendItemResponse(res, order, 'Supplier order retrieved successfully');
}));

// @desc    Create new supplier order
// @route   POST /api/supplier-orders
// @access  Public (temporarily for dashboard testing)
router.post('/', validateOrderData, validate, asyncHandler(async (req, res) => {
  console.log('📦 POST /api/supplier-orders - Request received:', {
    body: req.body,
    hasSupplier: !!req.body.supplier,
    itemsCount: req.body.items?.length || 0
  });
  
  try {
    // Verify supplier exists
    const supplier = await Supplier.findById(req.body.supplier);
    if (!supplier) {
      throw new ApiError('Supplier not found', 404);
    }

    // Calculate totals if not provided
    let subtotal = 0;
    if (req.body.items && req.body.items.length > 0) {
      req.body.items.forEach(item => {
        item.totalPrice = item.quantity * item.unitPrice;
        subtotal += item.totalPrice;
      });
    }

    if (!req.body.subtotal) {
      req.body.subtotal = subtotal;
    }

    if (!req.body.totalAmount) {
      req.body.totalAmount = req.body.subtotal + (req.body.tax || 0) + (req.body.shippingCost || 0);
    }

    // Generate order number if not provided
    if (!req.body.orderNumber) {
      try {
        const count = await SupplierOrder.countDocuments();
        const timestamp = Date.now();
        const sequence = String(count + 1).padStart(4, '0');
        req.body.orderNumber = `SUP-${timestamp}-${sequence}`;
        console.log('Generated order number:', req.body.orderNumber);
      } catch (error) {
        console.error('Error generating order number:', error);
        // Fallback order number
        req.body.orderNumber = `SUP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      }
    }

    // Set orderedBy from request (should be from auth in production)
    // For now, allow it to be passed from frontend or use req.user if available
    if (!req.body.orderedBy && req.user?.id) {
      req.body.orderedBy = req.user.id;
    }
    
    // If still no orderedBy, try to find a manager staff member as fallback
    if (!req.body.orderedBy) {
      const manager = await Staff.findOne({ role: 'manager', status: 'active' });
      if (manager) {
        req.body.orderedBy = manager._id;
        console.log('Using manager as orderedBy:', manager._id);
      } else {
        // Create a placeholder staff ID if none found (for development)
        console.warn('No manager found and no orderedBy provided. Order will be created without orderedBy.');
        // In production, you might want to require this field
      }
    }

    const order = await SupplierOrder.create(req.body);
    console.log('✅ Supplier order created successfully:', order._id);

    // Populate supplier info
    await order.populate('supplier', 'name email phone');
    await order.populate('orderedBy', 'name email');

    return sendCreated(res, order, 'Supplier order created successfully');
  } catch (error) {
    console.error('❌ Error creating supplier order:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(val => ({
        field: val.path,
        message: val.message
      }));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    throw error;
  }
}));

// @desc    Update supplier order
// @route   PUT /api/supplier-orders/:id
// @access  Public (temporarily for dashboard testing)
router.put('/:id', validateOrderId, asyncHandler(async (req, res) => {
  const order = await SupplierOrder.findById(req.params.id);

  if (!order) {
    return sendNotFound(res, 'Supplier order', req.params.id);
  }

  // If status is being changed to 'received', update warehouse inventory
  if (req.body.status === 'received' && order.status !== 'received') {
    // Update warehouse inventory for each item
    for (const item of order.items) {
      let inventory = await WarehouseInventory.findOne({
        itemType: item.itemType,
        description: item.description,
        isActive: true
      });

      if (inventory) {
        inventory.quantity += item.quantity;
        inventory.lastRestocked = new Date();
        if (req.body.receivedBy) {
          inventory.lastRestockedBy = req.body.receivedBy;
        }
        await inventory.save();
      } else {
        // Create new inventory item
        await WarehouseInventory.create({
          itemType: item.itemType,
          description: item.description,
          quantity: item.quantity,
          unit: 'pieces',
          lastRestocked: new Date(),
          lastRestockedBy: req.body.receivedBy || order.orderedBy
        });
      }
    }

    // Set receivedBy and actualDeliveryDate
    if (!req.body.actualDeliveryDate) {
      req.body.actualDeliveryDate = new Date();
    }
    if (!req.body.receivedBy && req.user?.id) {
      req.body.receivedBy = req.user.id;
    }
  }

  const updatedOrder = await SupplierOrder.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  )
    .populate('supplier', 'name email phone')
    .populate('orderedBy', 'name email')
    .populate('receivedBy', 'name email');

  return sendUpdated(res, updatedOrder, 'Supplier order updated successfully');
}));

// @desc    Update supplier order payment status
// @route   PUT /api/supplier-orders/:id/payment
// @access  Public (temporarily for dashboard testing)
router.put('/:id/payment', validateOrderId, asyncHandler(async (req, res) => {
  const { paymentStatus, paidAmount, paymentMethod, paymentReference, paymentDate, invoiceNumber } = req.body;
  
  const order = await SupplierOrder.findById(req.params.id);

  if (!order) {
    return sendNotFound(res, 'Supplier order', req.params.id);
  }

  if (!paymentStatus) {
    throw new ApiError('Payment status is required', 400);
  }

  const validPaymentStatuses = ['pending', 'paid', 'partial', 'overdue'];
  if (!validPaymentStatuses.includes(paymentStatus)) {
    throw new ApiError(`Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`, 400);
  }

  const updateData = {
    paymentStatus,
    updatedAt: new Date()
  };

  if (paymentMethod) updateData.paymentMethod = paymentMethod;
  if (paymentReference) updateData.paymentReference = paymentReference;
  if (paymentDate) updateData.paymentDate = new Date(paymentDate);
  if (invoiceNumber) updateData.invoiceNumber = invoiceNumber;

  // If partial payment, ensure paidAmount is provided
  if (paymentStatus === 'partial' && !paidAmount) {
    throw new ApiError('Paid amount is required for partial payments', 400);
  }

  // If full payment, set paymentStatus to 'paid'
  if (paymentStatus === 'paid' && paidAmount && paidAmount >= order.totalAmount) {
    updateData.paymentStatus = 'paid';
  } else if (paymentStatus === 'partial' && paidAmount && paidAmount < order.totalAmount) {
    updateData.paymentStatus = 'partial';
  }

  const updatedOrder = await SupplierOrder.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  )
    .populate('supplier', 'name email phone')
    .populate('orderedBy', 'name email')
    .populate('receivedBy', 'name email');

  return sendUpdated(res, updatedOrder, 'Supplier order payment status updated successfully');
}));

// @desc    Delete supplier order
// @route   DELETE /api/supplier-orders/:id
// @access  Public (temporarily for dashboard testing)
router.delete('/:id', validateOrderId, asyncHandler(async (req, res) => {
  const order = await SupplierOrder.findById(req.params.id);

  if (!order) {
    return sendNotFound(res, 'Supplier order', req.params.id);
  }

  // Only allow deletion if order is pending or cancelled
  if (order.status !== 'pending' && order.status !== 'cancelled') {
    throw new ApiError('Cannot delete order that is not pending or cancelled', 400);
  }

  await SupplierOrder.findByIdAndDelete(req.params.id);

  return sendDeleted(res, 'Supplier order deleted successfully');
}));

export default router;

