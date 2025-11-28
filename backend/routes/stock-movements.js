import express from 'express';
import StockMovement from '../models/StockMovement.js';

const router = express.Router();

// GET all stock movements
router.get('/', async (req, res) => {
  try {
    const stockMovements = await StockMovement.find()
      .populate('authorizedBy', 'name email')
      .sort({ date: -1 });
    
    res.json({
      success: true,
      data: stockMovements,
      count: stockMovements.length
    });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movements',
      error: error.message
    });
  }
});

// GET stock movement by ID
router.get('/:id', async (req, res) => {
  try {
    const stockMovement = await StockMovement.findById(req.params.id)
      .populate('authorizedBy', 'name email');
    
    if (!stockMovement) {
      return res.status(404).json({
        success: false,
        message: 'Stock movement not found'
      });
    }
    
    res.json({
      success: true,
      data: stockMovement
    });
  } catch (error) {
    console.error('Error fetching stock movement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movement',
      error: error.message
    });
  }
});

// POST create new stock movement
router.post('/', async (req, res) => {
  try {
    const stockMovementData = req.body;
    
    // Set default date if not provided
    if (!stockMovementData.date) {
      stockMovementData.date = new Date();
    }

    const newStockMovement = new StockMovement(stockMovementData);
    const savedStockMovement = await newStockMovement.save();

    // Populate the authorizedBy field for response
    await savedStockMovement.populate('authorizedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Stock movement created successfully',
      data: savedStockMovement
    });
  } catch (error) {
    console.error('Error creating stock movement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create stock movement',
      error: error.message
    });
  }
});

// PUT update stock movement
router.put('/:id', async (req, res) => {
  try {
    const stockMovementData = req.body;
    const stockMovementId = req.params.id;

    const updatedStockMovement = await StockMovement.findByIdAndUpdate(
      stockMovementId,
      stockMovementData,
      { new: true, runValidators: true }
    ).populate('authorizedBy', 'name email');

    if (!updatedStockMovement) {
      return res.status(404).json({
        success: false,
        message: 'Stock movement not found'
      });
    }

    res.json({
      success: true,
      message: 'Stock movement updated successfully',
      data: updatedStockMovement
    });
  } catch (error) {
    console.error('Error updating stock movement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock movement',
      error: error.message
    });
  }
});

// DELETE stock movement
router.delete('/:id', async (req, res) => {
  try {
    const stockMovementId = req.params.id;
    const deletedStockMovement = await StockMovement.findByIdAndDelete(stockMovementId);

    if (!deletedStockMovement) {
      return res.status(404).json({
        success: false,
        message: 'Stock movement not found'
      });
    }

    res.json({
      success: true,
      message: 'Stock movement deleted successfully',
      data: deletedStockMovement
    });
  } catch (error) {
    console.error('Error deleting stock movement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete stock movement',
      error: error.message
    });
  }
});

// GET stock movement statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalMovements = await StockMovement.countDocuments();
    const pendingMovements = await StockMovement.countDocuments({ status: 'pending' });
    const completedMovements = await StockMovement.countDocuments({ status: 'completed' });
    const cancelledMovements = await StockMovement.countDocuments({ status: 'cancelled' });

    // Get movements by type
    const movementsByType = await StockMovement.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get movements by product
    const movementsByProduct = await StockMovement.aggregate([
      { $group: { _id: '$product', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get recent movements
    const recentMovements = await StockMovement.find()
      .populate('authorizedBy', 'name')
      .sort({ date: -1 })
      .limit(5)
      .select('type product quantity date status');

    res.json({
      success: true,
      data: {
        totalMovements,
        pendingMovements,
        completedMovements,
        cancelledMovements,
        movementsByType,
        movementsByProduct,
        recentMovements
      }
    });
  } catch (error) {
    console.error('Error fetching stock movement statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movement statistics',
      error: error.message
    });
  }
});

// GET stock movements by type
router.get('/type/:type', async (req, res) => {
  try {
    const type = req.params.type;
    const stockMovements = await StockMovement.find({ type: type })
      .populate('authorizedBy', 'name email')
      .sort({ date: -1 });
    
    res.json({
      success: true,
      data: stockMovements,
      count: stockMovements.length
    });
  } catch (error) {
    console.error('Error fetching stock movements by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movements by type',
      error: error.message
    });
  }
});

// GET stock movements by product
router.get('/product/:product', async (req, res) => {
  try {
    const product = req.params.product;
    const stockMovements = await StockMovement.find({ product: product })
      .populate('authorizedBy', 'name email')
      .sort({ date: -1 });
    
    res.json({
      success: true,
      data: stockMovements,
      count: stockMovements.length
    });
  } catch (error) {
    console.error('Error fetching stock movements by product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movements by product',
      error: error.message
    });
  }
});

// GET stock movements by date range
router.get('/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const stockMovements = await StockMovement.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
    .populate('authorizedBy', 'name email')
    .sort({ date: -1 });
    
    res.json({
      success: true,
      data: stockMovements,
      count: stockMovements.length
    });
  } catch (error) {
    console.error('Error fetching stock movements by date range:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movements by date range',
      error: error.message
    });
  }
});

// GET pending stock movements
router.get('/status/pending', async (req, res) => {
  try {
    const pendingMovements = await StockMovement.find({ status: 'pending' })
      .populate('authorizedBy', 'name email')
      .sort({ date: 1 });
    
    res.json({
      success: true,
      data: pendingMovements,
      count: pendingMovements.length
    });
  } catch (error) {
    console.error('Error fetching pending stock movements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending stock movements',
      error: error.message
    });
  }
});

export default router;
















































































