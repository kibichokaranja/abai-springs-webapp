import express from 'express';
import Outlet from '../models/Outlet.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { 
  sendSuccess, 
  sendError, 
  sendNotFound, 
  sendCreated, 
  sendUpdated, 
  sendDeleted 
} from '../utils/responseHandler.js';
import { cacheOutlets, cacheOutlet, invalidateOutlets, invalidateOutlet } from '../middleware/cache.js';
import cacheManager from '../utils/cache.js';

const router = express.Router();

// @desc    Get all outlets
// @route   GET /api/outlets
// @access  Public
router.get('/', async (req, res) => {
  try {
    const outlets = await Outlet.find({ isActive: true }).sort({ name: 1 });

    return sendSuccess(res, {
      message: 'Outlets retrieved successfully',
      data: outlets
    });
  } catch (error) {
    console.error('Get outlets error:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Server error while fetching outlets',
      code: 'OUTLETS_ERROR'
    });
  }
});

// @desc    Get single outlet
// @route   GET /api/outlets/:id
// @access  Public
router.get('/:id', cacheOutlet, async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);

    if (!outlet) {
      return sendNotFound(res, 'Outlet', req.params.id);
    }

    return sendSuccess(res, {
      message: 'Outlet retrieved successfully',
      data: outlet
    });
  } catch (error) {
    console.error('Get outlet error:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Server error while fetching outlet',
      code: 'OUTLETS_ERROR'
    });
  }
});

// @desc    Create new outlet
// @route   POST /api/outlets
// @access  Public (temporarily for testing)
router.post('/', invalidateOutlets, async (req, res) => {
  try {
    const outlet = await Outlet.create(req.body);

    return sendCreated(res, outlet, 'Outlet created successfully');
  } catch (error) {
    console.error('Create outlet error:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Server error while creating outlet',
      code: 'OUTLETS_ERROR',
      details: process.env.NODE_ENV === 'development' ? { error: error.message } : undefined
    });
  }
});

// @desc    Update outlet
// @route   PUT /api/outlets/:id
// @access  Public (temporarily for testing)
router.put('/:id', async (req, res) => {
  try {
    const updatedOutlet = await Outlet.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedOutlet) {
      return sendNotFound(res, 'Outlet', req.params.id);
    }

    // Cache invalidation removed for immediate results
    console.log('Outlet updated successfully');

    return sendUpdated(res, updatedOutlet, 'Outlet updated successfully');
  } catch (error) {
    console.error('Update outlet error:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Server error while updating outlet',
      code: 'OUTLETS_ERROR'
    });
  }
});

// @desc    Delete outlet
// @route   DELETE /api/outlets/:id
// @access  Public (temporarily for testing)
router.delete('/:id', async (req, res) => {
  try {
    const outlet = await Outlet.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!outlet) {
      return sendNotFound(res, 'Outlet', req.params.id);
    }

    console.log(`Outlet ${outlet.name} (${outlet._id}) marked as inactive`);

    // Cache invalidation removed for immediate results
    console.log('Outlet deleted successfully');

    return sendDeleted(res, 'Outlet deleted successfully');
  } catch (error) {
    console.error('Delete outlet error:', error);
    return sendError(res, {
      statusCode: 500,
      message: 'Server error while deleting outlet',
      code: 'OUTLETS_ERROR'
    });
  }
});

export default router; 