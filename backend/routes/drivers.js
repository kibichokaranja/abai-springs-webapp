import express from 'express';
import Driver from '../models/Driver.js';

const router = express.Router();

// GET all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: drivers,
      count: drivers.length
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers',
      error: error.message
    });
  }
});

// GET driver by ID
router.get('/:id', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver',
      error: error.message
    });
  }
});

// POST create new driver
router.post('/', async (req, res) => {
  try {
    const driverData = req.body;
    
    // Check if email already exists
    const existingDriver = await Driver.findOne({ email: driverData.email });
    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Check if license already exists
    const existingLicense = await Driver.findOne({ license: driverData.license });
    if (existingLicense) {
      return res.status(400).json({
        success: false,
        message: 'License number already exists'
      });
    }

    const newDriver = new Driver(driverData);
    const savedDriver = await newDriver.save();

    res.status(201).json({
      success: true,
      message: 'Driver created successfully',
      data: savedDriver
    });
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create driver',
      error: error.message
    });
  }
});

// PUT update driver
router.put('/:id', async (req, res) => {
  try {
    const driverData = req.body;
    const driverId = req.params.id;

    // Check if email is being changed and if it already exists
    if (driverData.email) {
      const existingDriver = await Driver.findOne({ 
        email: driverData.email, 
        _id: { $ne: driverId } 
      });
      if (existingDriver) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Check if license is being changed and if it already exists
    if (driverData.license) {
      const existingLicense = await Driver.findOne({ 
        license: driverData.license, 
        _id: { $ne: driverId } 
      });
      if (existingLicense) {
        return res.status(400).json({
          success: false,
          message: 'License number already exists'
        });
      }
    }

    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      driverData,
      { new: true, runValidators: true }
    );

    if (!updatedDriver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      message: 'Driver updated successfully',
      data: updatedDriver
    });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update driver',
      error: error.message
    });
  }
});

// DELETE driver
router.delete('/:id', async (req, res) => {
  try {
    const driverId = req.params.id;
    const deletedDriver = await Driver.findByIdAndDelete(driverId);

    if (!deletedDriver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      message: 'Driver deleted successfully',
      data: deletedDriver
    });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete driver',
      error: error.message
    });
  }
});

// GET driver statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalDrivers = await Driver.countDocuments();
    const activeDrivers = await Driver.countDocuments({ status: 'active' });
    const onDeliveryDrivers = await Driver.countDocuments({ status: 'on-delivery' });
    const offDutyDrivers = await Driver.countDocuments({ status: 'off-duty' });

    // Get drivers by territory
    const driversByTerritory = await Driver.aggregate([
      { $group: { _id: '$territory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get top performing drivers
    const topPerformers = await Driver.find({ status: 'active' })
      .sort({ 'performance.successfulDeliveries': -1 })
      .limit(5)
      .select('name territory rating performance.successfulDeliveries performance.totalDeliveries');

    // Get average rating
    const averageRating = await Driver.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalDrivers,
        activeDrivers,
        onDeliveryDrivers,
        offDutyDrivers,
        driversByTerritory,
        topPerformers,
        averageRating: Math.round(averageRating[0]?.avgRating || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching driver statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver statistics',
      error: error.message
    });
  }
});

// GET drivers by territory
router.get('/territory/:territory', async (req, res) => {
  try {
    const territory = req.params.territory;
    const drivers = await Driver.find({ territory: territory }).sort({ name: 1 });
    
    res.json({
      success: true,
      data: drivers,
      count: drivers.length
    });
  } catch (error) {
    console.error('Error fetching drivers by territory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers by territory',
      error: error.message
    });
  }
});

// GET available drivers
router.get('/available/status', async (req, res) => {
  try {
    const availableDrivers = await Driver.find({ status: 'active' }).sort({ name: 1 });
    
    res.json({
      success: true,
      data: availableDrivers,
      count: availableDrivers.length
    });
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available drivers',
      error: error.message
    });
  }
});

// GET top performing drivers
router.get('/top-performers/:limit?', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    const topPerformers = await Driver.find({ status: 'active' })
      .sort({ 'performance.successfulDeliveries': -1 })
      .limit(limit);
    
    res.json({
      success: true,
      data: topPerformers,
      count: topPerformers.length
    });
  } catch (error) {
    console.error('Error fetching top performing drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top performing drivers',
      error: error.message
    });
  }
});

export default router;











































