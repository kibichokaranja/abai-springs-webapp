import express from 'express';
import Outlet from '../models/Outlet.js';

const router = express.Router();

// @desc    Get all outlets
// @route   GET /api/outlets
// @access  Public
router.get('/', async (req, res) => {
  console.log('🎯 Outlets route handler called');
  try {
    const outlets = await Outlet.find({ isActive: true }).sort({ name: 1 });
    console.log(`🏪 Found ${outlets.length} outlets`);
    
    res.json({
      success: true,
      message: 'Outlets retrieved successfully',
      data: outlets
    });
  } catch (error) {
    console.error('Get outlets error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving outlets',
      error: error.message
    });
  }
});

// @desc    Get single outlet
// @route   GET /api/outlets/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);
    
    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: 'Outlet not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Outlet retrieved successfully',
      data: outlet
    });
  } catch (error) {
    console.error('Get outlet error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving outlet',
      error: error.message
    });
  }
});

export default router;
