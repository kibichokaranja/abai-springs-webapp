 import express from 'express';
import OutletInventory from '../models/OutletInventory.js';
import Outlet from '../models/Outlet.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../middleware/validate.js';
import ApiError from '../utils/ApiError.js';

const router = express.Router();

// @desc    Get inventory overview
// @route   GET /api/inventory
// @access  Public
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Inventory API is working',
      endpoints: {
        outlet: '/api/inventory/outlet/:outletId',
        product: '/api/inventory/product/:productId',
        check: '/api/inventory/check/:outletId/:productId',
        alerts: '/api/inventory/alerts',
        summary: '/api/inventory/summary'
      }
    });
  } catch (error) {
    console.error('Error in inventory route:', error);
    res.status(500).json({
      success: false,
      message: 'Inventory API error'
    });
  }
});

// Get all inventory for a specific outlet
router.get('/outlet/:outletId', asyncHandler(async (req, res) => {
  const { outletId } = req.params;
  
  const inventory = await OutletInventory.find({ outlet: outletId, isActive: true })
    .populate('product', 'name brand category price image')
    .populate('outlet', 'name address');
  
  res.json({
    success: true,
    data: inventory,
    message: 'Outlet inventory retrieved successfully'
  });
}));

// Get all inventory for a specific product across all outlets
router.get('/product/:productId', asyncHandler(async (req, res) => {
  const { productId } = req.params;
  
  const inventory = await OutletInventory.find({ product: productId, isActive: true })
    .populate('outlet', 'name address phone email')
    .populate('product', 'name brand category price image');
  
  res.json({
    success: true,
    data: inventory,
    message: 'Product inventory across outlets retrieved successfully'
  });
}));

// Check stock availability for a specific product at a specific outlet
router.get('/check/:outletId/:productId', asyncHandler(async (req, res) => {
  const { outletId, productId } = req.params;
  const { quantity = 1 } = req.query;
  
  const stockCheck = await OutletInventory.checkStock(outletId, productId, parseInt(quantity));
  
  res.json({
    success: true,
    data: stockCheck,
    message: stockCheck.available ? 'Stock available' : 'Stock unavailable'
  });
}));

// Get low stock alerts across all outlets
router.get('/alerts', asyncHandler(async (req, res) => {
  const lowStockInventory = await OutletInventory.find({
    isActive: true,
    $expr: {
      $lte: [
        { $subtract: ['$stockLevel', '$reservedStock'] },
        '$lowStockThreshold'
      ]
    }
  })
  .populate('outlet', 'name address phone')
  .populate('product', 'name brand category price');
  
  res.json({
    success: true,
    data: lowStockInventory,
    message: 'Low stock alerts retrieved successfully'
  });
}));

// Create or update inventory for a product at an outlet
router.post('/', asyncHandler(async (req, res) => {
  const { outletId, productId, stockLevel, lowStockThreshold, notes } = req.body;
  
  // Validate that outlet and product exist
  const [outlet, product] = await Promise.all([
    Outlet.findById(outletId),
    Product.findById(productId)
  ]);
  
  if (!outlet) {
    throw new ApiError(404, 'Outlet not found');
  }
  
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  // Use findOneAndUpdate with upsert to create or update
  const inventory = await OutletInventory.findOneAndUpdate(
    { outlet: outletId, product: productId },
    {
      stockLevel: stockLevel || 0,
      lowStockThreshold: lowStockThreshold || 10,
      notes: notes || '',
      isActive: true,
      lastRestocked: new Date()
    },
    { upsert: true, new: true, runValidators: true }
  )
  .populate('outlet', 'name address')
  .populate('product', 'name brand category price');
  
  res.status(201).json({
    success: true,
    data: inventory,
    message: 'Inventory created/updated successfully'
  });
}));

// Update inventory for a specific outlet-product combination
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stockLevel, lowStockThreshold, notes, isActive } = req.body;
  
  const inventory = await OutletInventory.findByIdAndUpdate(
    id,
    {
      ...(stockLevel !== undefined && { stockLevel }),
      ...(lowStockThreshold !== undefined && { lowStockThreshold }),
      ...(notes !== undefined && { notes }),
      ...(isActive !== undefined && { isActive }),
      ...(stockLevel !== undefined && { lastRestocked: new Date() })
    },
    { new: true, runValidators: true }
  )
  .populate('outlet', 'name address')
  .populate('product', 'name brand category price');
  
  if (!inventory) {
    throw new ApiError(404, 'Inventory record not found');
  }
  
  res.json({
    success: true,
    data: inventory,
    message: 'Inventory updated successfully'
  });
}));

// Delete inventory record
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const inventory = await OutletInventory.findByIdAndDelete(id);
  
  if (!inventory) {
    throw new ApiError(404, 'Inventory record not found');
  }
  
  res.json({
    success: true,
    message: 'Inventory record deleted successfully'
  });
}));

// Get inventory summary across all outlets
router.get('/summary', asyncHandler(async (req, res) => {
  const summary = await OutletInventory.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalProducts: { $addToSet: '$product' },
        totalOutlets: { $addToSet: '$outlet' },
        totalStock: { $sum: '$stockLevel' },
        totalReserved: { $sum: '$reservedStock' },
        lowStockItems: {
          $sum: {
            $cond: [
              { $lte: [{ $subtract: ['$stockLevel', '$reservedStock'] }, '$lowStockThreshold'] },
              1,
              0
            ]
          }
        },
        outOfStockItems: {
          $sum: {
            $cond: [
              { $lte: [{ $subtract: ['$stockLevel', '$reservedStock'] }, 0] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalProducts: { $size: '$totalProducts' },
        totalOutlets: { $size: '$totalOutlets' },
        totalStock: 1,
        totalReserved: 1,
        totalAvailable: { $subtract: ['$totalStock', '$totalReserved'] },
        lowStockItems: 1,
        outOfStockItems: 1
      }
    }
  ]);
  
  res.json({
    success: true,
    data: summary[0] || {
      totalProducts: 0,
      totalOutlets: 0,
      totalStock: 0,
      totalReserved: 0,
      totalAvailable: 0,
      lowStockItems: 0,
      outOfStockItems: 0
    },
    message: 'Inventory summary retrieved successfully'
  });
}));

export default router;
