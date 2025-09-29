import express from 'express';
import Salesperson from '../models/Salesperson.js';

const router = express.Router();

// GET all salespeople
router.get('/', async (req, res) => {
  try {
    const salespeople = await Salesperson.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: salespeople,
      count: salespeople.length
    });
  } catch (error) {
    console.error('Error fetching salespeople:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch salespeople',
      error: error.message
    });
  }
});

// GET salesperson by ID
router.get('/:id', async (req, res) => {
  try {
    const salesperson = await Salesperson.findById(req.params.id);
    if (!salesperson) {
      return res.status(404).json({
        success: false,
        message: 'Salesperson not found'
      });
    }
    res.json({
      success: true,
      data: salesperson
    });
  } catch (error) {
    console.error('Error fetching salesperson:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch salesperson',
      error: error.message
    });
  }
});

// POST create new salesperson
router.post('/', async (req, res) => {
  try {
    const salespersonData = req.body;
    
    // Check if email already exists
    const existingSalesperson = await Salesperson.findOne({ email: salespersonData.email });
    if (existingSalesperson) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const newSalesperson = new Salesperson(salespersonData);
    const savedSalesperson = await newSalesperson.save();

    res.status(201).json({
      success: true,
      message: 'Salesperson created successfully',
      data: savedSalesperson
    });
  } catch (error) {
    console.error('Error creating salesperson:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create salesperson',
      error: error.message
    });
  }
});

// PUT update salesperson
router.put('/:id', async (req, res) => {
  try {
    const salespersonData = req.body;
    const salespersonId = req.params.id;

    // Check if email is being changed and if it already exists
    if (salespersonData.email) {
      const existingSalesperson = await Salesperson.findOne({ 
        email: salespersonData.email, 
        _id: { $ne: salespersonId } 
      });
      if (existingSalesperson) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    const updatedSalesperson = await Salesperson.findByIdAndUpdate(
      salespersonId,
      salespersonData,
      { new: true, runValidators: true }
    );

    if (!updatedSalesperson) {
      return res.status(404).json({
        success: false,
        message: 'Salesperson not found'
      });
    }

    res.json({
      success: true,
      message: 'Salesperson updated successfully',
      data: updatedSalesperson
    });
  } catch (error) {
    console.error('Error updating salesperson:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update salesperson',
      error: error.message
    });
  }
});

// DELETE salesperson
router.delete('/:id', async (req, res) => {
  try {
    const salespersonId = req.params.id;
    const deletedSalesperson = await Salesperson.findByIdAndDelete(salespersonId);

    if (!deletedSalesperson) {
      return res.status(404).json({
        success: false,
        message: 'Salesperson not found'
      });
    }

    res.json({
      success: true,
      message: 'Salesperson deleted successfully',
      data: deletedSalesperson
    });
  } catch (error) {
    console.error('Error deleting salesperson:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete salesperson',
      error: error.message
    });
  }
});

// GET sales statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalSalespeople = await Salesperson.countDocuments();
    const activeSalespeople = await Salesperson.countDocuments({ status: 'active' });
    const totalSalesTarget = await Salesperson.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$salesTarget' } } }
    ]);
    const totalCurrentSales = await Salesperson.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$currentSales' } } }
    ]);

    // Get salespeople by territory
    const salespeopleByTerritory = await Salesperson.aggregate([
      { $group: { _id: '$territory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get top performers
    const topPerformers = await Salesperson.find({ status: 'active' })
      .sort({ 'performance.totalSales': -1 })
      .limit(5)
      .select('name territory salesTarget currentSales performance.totalSales');

    res.json({
      success: true,
      data: {
        totalSalespeople,
        activeSalespeople,
        totalSalesTarget: totalSalesTarget[0]?.total || 0,
        totalCurrentSales: totalCurrentSales[0]?.total || 0,
        salespeopleByTerritory,
        topPerformers
      }
    });
  } catch (error) {
    console.error('Error fetching sales statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales statistics',
      error: error.message
    });
  }
});

// GET salespeople by territory
router.get('/territory/:territory', async (req, res) => {
  try {
    const territory = req.params.territory;
    const salespeople = await Salesperson.find({ territory: territory }).sort({ name: 1 });
    
    res.json({
      success: true,
      data: salespeople,
      count: salespeople.length
    });
  } catch (error) {
    console.error('Error fetching salespeople by territory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch salespeople by territory',
      error: error.message
    });
  }
});

// GET top performers
router.get('/top-performers/:limit?', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    const topPerformers = await Salesperson.find({ status: 'active' })
      .sort({ 'performance.totalSales': -1 })
      .limit(limit);
    
    res.json({
      success: true,
      data: topPerformers,
      count: topPerformers.length
    });
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top performers',
      error: error.message
    });
  }
});

export default router;











































