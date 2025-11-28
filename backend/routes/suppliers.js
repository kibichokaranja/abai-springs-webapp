import express from 'express';
import { body, param, query } from 'express-validator';
import Supplier from '../models/Supplier.js';
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

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Suppliers router is working' });
});

// Validation rules
const validateSupplierId = [
  param('id').isMongoId().withMessage('Invalid supplier ID format')
];

const validateSupplierData = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Supplier name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters'),
  body('itemsSupplied')
    .optional()
    .isArray()
    .withMessage('Items supplied must be an array')
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

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Public (temporarily for dashboard testing)
router.get('/', validateQueryParams, asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20, isActive } = req.query;

  const query = {};
  
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  } else {
    query.isActive = true; // Default to active suppliers
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { contactPerson: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;
  const suppliers = await Supplier.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Supplier.countDocuments(query);

  return sendListResponse(res, suppliers, page, limit, total, 'Suppliers retrieved successfully');
}));

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// @access  Public
router.get('/:id', validateSupplierId, asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    return sendNotFound(res, 'Supplier', req.params.id);
  }

  return sendItemResponse(res, supplier, 'Supplier retrieved successfully');
}));

// @desc    Create new supplier
// @route   POST /api/suppliers
// @access  Public (temporarily for dashboard testing)
router.post('/', async (req, res, next) => {
  console.log('📦 POST /api/suppliers - Request received:', {
    body: req.body,
    hasBody: !!req.body,
    contentType: req.headers['content-type']
  });
  
  try {
    // Manual validation first
    const errors = [];
    if (!req.body.name || req.body.name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Supplier name must be at least 2 characters' });
    }
    if (!req.body.email || !/^\S+@\S+\.\S+$/.test(req.body.email)) {
      errors.push({ field: 'email', message: 'Please provide a valid email' });
    }
    if (!req.body.phone || req.body.phone.trim().length < 10 || req.body.phone.trim().length > 20) {
      errors.push({ field: 'phone', message: 'Phone number must be between 10 and 20 characters' });
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    const supplier = await Supplier.create(req.body);
    console.log('✅ Supplier created successfully:', supplier._id);
    return sendCreated(res, supplier, 'Supplier created successfully');
  } catch (error) {
    console.error('❌ Error creating supplier:', {
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
    
    // Handle duplicate key error (e.g., duplicate email)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        error: `Duplicate ${field} value. This ${field} already exists.`,
        details: [{ field, message: `This ${field} is already in use` }]
      });
    }
    
    // Pass to error handler
    next(error);
  }
});

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Public (temporarily for dashboard testing)
router.put('/:id', validateSupplierId, validateSupplierData, validate, asyncHandler(async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return sendNotFound(res, 'Supplier', req.params.id);
    }

    const updatedSupplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedSupplier) {
      return sendNotFound(res, 'Supplier', req.params.id);
    }

    return sendUpdated(res, updatedSupplier, 'Supplier updated successfully');
  } catch (error) {
    console.error('Error updating supplier:', error);
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
    throw error; // Let asyncHandler catch other errors
  }
}));

// @desc    Delete supplier (soft delete)
// @route   DELETE /api/suppliers/:id
// @access  Public (temporarily for dashboard testing)
router.delete('/:id', validateSupplierId, asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    return sendNotFound(res, 'Supplier', req.params.id);
  }

  // Soft delete - just mark as inactive
  supplier.isActive = false;
  await supplier.save();

  return sendDeleted(res, 'Supplier deleted successfully');
}));

export default router;

