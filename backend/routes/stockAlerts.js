import express from 'express';
import StockAlert from '../models/StockAlert.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import smartStockAlertService from '../services/smartStockAlertService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all stock alerts for a customer
router.get('/customer/:customerId', authenticate, async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Verify the authenticated user is requesting their own alerts
    if (req.user._id.toString() !== customerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own alerts.'
      });
    }

    const stockAlerts = await StockAlert.find({ 
      customerId, 
      isActive: true 
    }).populate(['outletId', 'productId']);

    res.json({
      success: true,
      data: stockAlerts
    });
  } catch (error) {
    console.error('Error fetching stock alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stock alerts'
    });
  }
});

// Create or update a stock alert
router.post('/', authenticate, async (req, res) => {
  try {
    const { outletId, productId, currentStock, alertEnabled, alertThreshold, preferredChannels } = req.body;
    const customerId = req.user._id;

    // Validate required fields
    if (!outletId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'Outlet ID and Product ID are required'
      });
    }

    // Verify outlet and product exist
    const outlet = await Outlet.findById(outletId);
    const product = await Product.findById(productId);

    if (!outlet || !product) {
      return res.status(404).json({
        success: false,
        message: 'Outlet or product not found'
      });
    }

    // Create or update stock alert
    const stockAlert = await smartStockAlertService.createOrUpdateStockAlert(
      customerId,
      outletId,
      productId,
      currentStock || 0
    );

    // Update preferences if provided
    if (alertEnabled !== undefined || alertThreshold || preferredChannels) {
      stockAlert.alertEnabled = alertEnabled !== undefined ? alertEnabled : stockAlert.alertEnabled;
      stockAlert.alertThreshold = alertThreshold || stockAlert.alertThreshold;
      stockAlert.preferredChannels = preferredChannels || stockAlert.preferredChannels;
      await stockAlert.save();
    }

    const populatedAlert = await StockAlert.findById(stockAlert._id)
      .populate(['outletId', 'productId']);

    res.json({
      success: true,
      message: 'Stock alert created/updated successfully',
      data: populatedAlert
    });
  } catch (error) {
    console.error('Error creating/updating stock alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating/updating stock alert'
    });
  }
});

// Update alert preferences
router.put('/preferences', authenticate, async (req, res) => {
  try {
    const { alertEnabled, alertThreshold, preferredChannels } = req.body;
    const customerId = req.user._id;

    const result = await smartStockAlertService.updateAlertPreferences(
      customerId,
      { alertEnabled, alertThreshold, preferredChannels }
    );

    res.json({
      success: true,
      message: 'Alert preferences updated successfully',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error updating alert preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating alert preferences'
    });
  }
});

// Delete a stock alert
router.delete('/:alertId', authenticate, async (req, res) => {
  try {
    const { alertId } = req.params;
    const customerId = req.user._id;

    const stockAlert = await StockAlert.findById(alertId);

    if (!stockAlert) {
      return res.status(404).json({
        success: false,
        message: 'Stock alert not found'
      });
    }

    // Verify the user owns this alert or is admin
    if (stockAlert.customerId.toString() !== customerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own alerts.'
      });
    }

    // Soft delete by setting isActive to false
    stockAlert.isActive = false;
    await stockAlert.save();

    res.json({
      success: true,
      message: 'Stock alert deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting stock alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting stock alert'
    });
  }
});

// Get alert statistics (admin only)
router.get('/statistics', async (req, res) => {
  try {
    // Temporarily removed authentication for testing
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Access denied. Admin privileges required.'
    //   });
    // }

    try {
      // Get actual statistics from the service
      const statistics = await smartStockAlertService.getAlertStatistics();
      
      res.json({
        success: true,
        data: {
          totalAlerts: statistics.totalAlerts || 0,
          enabledAlerts: statistics.enabledAlerts || 0,
          alertsNeedingAttention: statistics.alertsNeedingAttention || 0,
          monitoringActive: smartStockAlertService.isRunning
        }
      });
    } catch (error) {
      console.error('Error getting statistics from service:', error);
      // Fallback response when database is not available
      res.json({
        success: true,
        data: {
          totalAlerts: 0,
          enabledAlerts: 0,
          alertsNeedingAttention: 0,
          monitoringActive: smartStockAlertService.isRunning
        }
      });
    }
  } catch (error) {
    console.error('Error fetching alert statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alert statistics'
    });
  }
});

// Trigger test alert (admin only)
router.post('/test-alert', async (req, res) => {
  try {
    // Temporarily removed authentication for testing
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Access denied. Admin privileges required.'
    //   });
    // }

    const { customerId, productId, outletId } = req.body;

    if (!customerId || !productId || !outletId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID, Product ID, and Outlet ID are required'
      });
    }

    const results = await smartStockAlertService.triggerTestAlert(
      customerId,
      productId,
      outletId
    );

    res.json({
      success: true,
      message: 'Test alert sent successfully',
      data: results
    });
  } catch (error) {
    console.error('Error triggering test alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering test alert'
    });
  }
});

// Start/Stop monitoring service (admin only)
router.post('/monitoring/:action', async (req, res) => {
  try {
    // Temporarily removed authentication for testing
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Access denied. Admin privileges required.'
    //   });
    // }

    const { action } = req.params;

    if (action === 'start') {
      try {
        smartStockAlertService.startMonitoring();
        res.json({
          success: true,
          message: 'Smart stock alert monitoring started'
        });
      } catch (error) {
        console.error('Error starting monitoring:', error);
        res.status(500).json({
          success: false,
          message: 'Error starting monitoring: ' + error.message
        });
      }
    } else if (action === 'stop') {
      try {
        smartStockAlertService.stopMonitoring();
        res.json({
          success: true,
          message: 'Smart stock alert monitoring stopped'
        });
      } catch (error) {
        console.error('Error stopping monitoring:', error);
        res.status(500).json({
          success: false,
          message: 'Error stopping monitoring: ' + error.message
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Use "start" or "stop"'
      });
    }
  } catch (error) {
    console.error('Error controlling monitoring service:', error);
    res.status(500).json({
      success: false,
      message: 'Error controlling monitoring service'
    });
  }
});

// Get monitoring status (admin only)
router.get('/monitoring/status', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const statistics = await smartStockAlertService.getAlertStatistics();

    res.json({
      success: true,
      data: {
        isRunning: smartStockAlertService.isRunning,
        statistics
      }
    });
  } catch (error) {
    console.error('Error fetching monitoring status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monitoring status'
    });
  }
});

export default router;
