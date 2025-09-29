import express from 'express';
import { body, param, query } from 'express-validator';
import Product from '../models/Product.js';
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
import { cacheProducts, cacheProduct, invalidateProducts, invalidateProduct } from '../middleware/cache.js';

const router = express.Router();

// Validation rules
const validateProductId = [
  param('id').isMongoId().withMessage('Invalid product ID format')
];

const validateProductData = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Product name must be between 2 and 100 characters'),
  body('brand')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Brand must be between 2 and 50 characters'),
  body('category')
    .isIn(['500ml', '1 Litre', '2 Litres', '5 Litres', '10 Litres', '20 Litres'])
    .withMessage('Invalid category selected'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('stockLevel')
    .isInt({ min: 0 })
    .withMessage('Stock level must be a non-negative integer'),
  body('lowStockThreshold')
    .isInt({ min: 0 })
    .withMessage('Low stock threshold must be a non-negative integer'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters')
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
  query('search')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Search term must be at least 2 characters')
];

// @desc    Get all products
// @route   GET /api/products
// @access  Public
router.get('/', validateQueryParams, cacheProducts, asyncHandler(async (req, res) => {
  const { brand, category, search, page = 1, limit = 20 } = req.query;

  // Build query
  const query = { isActive: true };

  if (brand) {
    query.brand = brand;
  }

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$text = { $search: search };
  }

  // Pagination
  const skip = (page - 1) * limit;
  const products = await Product.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Product.countDocuments(query);

  return sendListResponse(res, products, page, limit, total, 'Products retrieved successfully');
}));

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', validateProductId, cacheProduct, asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return sendNotFound(res, 'Product', req.params.id);
  }

  return sendItemResponse(res, product, 'Product retrieved successfully');
}));

// @desc    Create new product
// @route   POST /api/products
// @access  Public (temporarily for dashboard testing)
router.post('/', validateProductData, invalidateProducts, asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);

  return sendCreated(res, product, 'Product created successfully');
}));

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Public (temporarily for dashboard testing)
router.put('/:id', validateProductId, validateProductData, invalidateProduct, invalidateProducts, asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return sendNotFound(res, 'Product', req.params.id);
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  return sendUpdated(res, updatedProduct, 'Product updated successfully');
}));

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Public (temporarily for dashboard testing)
router.delete('/:id', validateProductId, invalidateProduct, invalidateProducts, asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return sendNotFound(res, 'Product', req.params.id);
  }

  // Soft delete - just mark as inactive
  product.isActive = false;
  await product.save();

  return sendDeleted(res, 'Product deleted successfully');
}));

// @desc    Permanently delete product
// @route   DELETE /api/products/:id/permanent
// @access  Public (temporarily for dashboard testing)
router.delete('/:id/permanent', validateProductId, invalidateProduct, invalidateProducts, asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return sendNotFound(res, 'Product', req.params.id);
  }

  // Hard delete - actually remove from database
  await Product.findByIdAndDelete(req.params.id);

  return sendDeleted(res, 'Product permanently deleted successfully');
}));

// @desc    Get products by brand
// @route   GET /api/products/brand/:brand
// @access  Public
router.get('/brand/:brand', validateQueryParams, asyncHandler(async (req, res) => {
  const { brand } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const skip = (page - 1) * limit;
  const products = await Product.find({ 
    brand, 
    isActive: true 
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Product.countDocuments({ brand, isActive: true });

  res.json({
    success: true,
    data: products,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      hasNext: skip + products.length < total,
      hasPrev: page > 1
    }
  });
}));

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
router.get('/search', validateQueryParams, asyncHandler(async (req, res) => {
  const { q, brand, category, page = 1, limit = 20 } = req.query;

  const query = { isActive: true };

  if (q) {
    query.$text = { $search: q };
  }

  if (brand) {
    query.brand = brand;
  }

  if (category) {
    query.category = category;
  }

  const skip = (page - 1) * limit;
  const products = await Product.find(query)
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Product.countDocuments(query);

  res.json({
    success: true,
    data: products,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      hasNext: skip + products.length < total,
      hasPrev: page > 1
    }
  });
}));

// @desc    Get all products for admin (including inactive)
// @route   GET /api/products/admin/all
// @access  Public (temporarily for dashboard testing)
router.get('/admin/all', asyncHandler(async (req, res) => {
  const { brand, category, search, page = 1, limit = 100 } = req.query;

  // Build query - include all products regardless of isActive status
  const query = {};

  if (brand) {
    query.brand = brand;
  }

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$text = { $search: search };
  }

  // Pagination
  const skip = (page - 1) * limit;
  const products = await Product.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Product.countDocuments(query);

  return sendListResponse(res, products, page, limit, total, 'All products retrieved successfully');
}));

export default router; 