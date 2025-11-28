import express from 'express';
import { body, param, query } from 'express-validator';
import WarehouseInventory from '../models/WarehouseInventory.js';
import { asyncHandler, ApiError } from '../middleware/validate.js';
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
const validateInventoryId = [
  param('id').isMongoId().withMessage('Invalid inventory ID format')
];

const validateInventoryData = [
  body('itemType')
    .isIn(['bottles', 'bottle_tops', 'branding', 'labels', 'packaging', 'other'])
    .withMessage('Invalid item type'),
  body('description')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Description must be between 2 and 200 characters'),
  body('quantity')
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  body('unit')
    .isIn(['pieces', 'boxes', 'rolls', 'sheets', 'units'])
    .withMessage('Invalid unit')
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

// @desc    Get all warehouse inventory items
// @route   GET /api/warehouse-inventory
// @access  Public (temporarily for dashboard testing)
router.get('/', validateQueryParams, asyncHandler(async (req, res) => {
  const { itemType, search, lowStock, page = 1, limit = 50 } = req.query;

  const query = { isActive: true };

  if (itemType) {
    query.itemType = itemType;
  }

  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } }
    ];
  }

  if (lowStock === 'true') {
    query.$expr = {
      $lte: ['$quantity', '$lowStockThreshold']
    };
  }

  const skip = (page - 1) * limit;
  const inventory = await WarehouseInventory.find(query)
    .populate('supplier', 'name email')
    .populate('lastRestockedBy', 'name email')
    .sort({ itemType: 1, description: 1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await WarehouseInventory.countDocuments(query);

  return sendListResponse(res, inventory, page, limit, total, 'Warehouse inventory retrieved successfully');
}));

// @desc    Get single warehouse inventory item
// @route   GET /api/warehouse-inventory/:id
// @access  Public
router.get('/:id', validateInventoryId, asyncHandler(async (req, res) => {
  const item = await WarehouseInventory.findById(req.params.id)
    .populate('supplier', 'name email')
    .populate('lastRestockedBy', 'name email');

  if (!item) {
    return sendNotFound(res, 'Warehouse inventory item', req.params.id);
  }

  return sendItemResponse(res, item, 'Warehouse inventory item retrieved successfully');
}));

// @desc    Create new warehouse inventory item
// @route   POST /api/warehouse-inventory
// @access  Public (temporarily for dashboard testing)
router.post('/', validateInventoryData, asyncHandler(async (req, res) => {
  const item = await WarehouseInventory.create(req.body);

  await item.populate('supplier', 'name email');
  await item.populate('lastRestockedBy', 'name email');

  return sendCreated(res, item, 'Warehouse inventory item created successfully');
}));

// @desc    Update warehouse inventory item
// @route   PUT /api/warehouse-inventory/:id
// @access  Public (temporarily for dashboard testing)
router.put('/:id', validateInventoryId, validateInventoryData, asyncHandler(async (req, res) => {
  const item = await WarehouseInventory.findById(req.params.id);

  if (!item) {
    return sendNotFound(res, 'Warehouse inventory item', req.params.id);
  }

  const updatedItem = await WarehouseInventory.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  )
    .populate('supplier', 'name email')
    .populate('lastRestockedBy', 'name email');

  return sendUpdated(res, updatedItem, 'Warehouse inventory item updated successfully');
}));

// @desc    Adjust warehouse inventory quantity
// @route   PATCH /api/warehouse-inventory/:id/adjust
// @access  Public (temporarily for dashboard testing)
router.patch('/:id/adjust', [
  validateInventoryId[0],
  body('quantityChange')
    .isInt()
    .withMessage('Quantity change must be an integer'),
  body('reason')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Reason must be between 2 and 200 characters')
], asyncHandler(async (req, res) => {
  const item = await WarehouseInventory.findById(req.params.id);

  if (!item) {
    return sendNotFound(res, 'Warehouse inventory item', req.params.id);
  }

  const { quantityChange, reason, notes } = req.body;
  const newQuantity = item.quantity + quantityChange;

  if (newQuantity < 0) {
    throw new ApiError('Insufficient inventory. Cannot adjust below zero.', 400);
  }

  item.quantity = newQuantity;
  if (notes) {
    item.notes = notes;
  }
  if (req.body.lastRestockedBy) {
    item.lastRestockedBy = req.body.lastRestockedBy;
    item.lastRestocked = new Date();
  }

  await item.save();

  await item.populate('supplier', 'name email');
  await item.populate('lastRestockedBy', 'name email');

  return sendUpdated(res, item, `Inventory adjusted by ${quantityChange > 0 ? '+' : ''}${quantityChange}. ${reason}`);
}));

// @desc    Delete warehouse inventory item (soft delete)
// @route   DELETE /api/warehouse-inventory/:id
// @access  Public (temporarily for dashboard testing)
router.delete('/:id', validateInventoryId, asyncHandler(async (req, res) => {
  const item = await WarehouseInventory.findById(req.params.id);

  if (!item) {
    return sendNotFound(res, 'Warehouse inventory item', req.params.id);
  }

  // Soft delete - just mark as inactive
  item.isActive = false;
  await item.save();

  return sendDeleted(res, 'Warehouse inventory item deleted successfully');
}));

// @desc    Get warehouse inventory summary/stats
// @route   GET /api/warehouse-inventory/stats/summary
// @access  Public
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const totalItems = await WarehouseInventory.countDocuments({ isActive: true });
  
  const lowStockItems = await WarehouseInventory.countDocuments({
    isActive: true,
    $expr: {
      $lte: ['$quantity', '$lowStockThreshold']
    }
  });

  const outOfStockItems = await WarehouseInventory.countDocuments({
    isActive: true,
    quantity: 0
  });

  const itemsByType = await WarehouseInventory.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$itemType',
        totalQuantity: { $sum: '$quantity' },
        itemCount: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      totalItems,
      lowStockItems,
      outOfStockItems,
      itemsByType
    },
    message: 'Warehouse inventory summary retrieved successfully'
  });
}));

export default router;




