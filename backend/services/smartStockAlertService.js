import StockAlert from '../models/StockAlert.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import notificationService from './notificationService.js';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class SmartStockAlertService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
  }

  // Start the smart alert monitoring service
  startMonitoring() {
    try {
      if (this.isRunning) {
        logger.info('Smart alert monitoring is already running');
        return;
      }

      this.isRunning = true;
      logger.info('Starting smart stock alert monitoring service');

      // Check for alerts every hour
      this.checkInterval = setInterval(async () => {
        try {
          await this.processStockAlerts();
        } catch (error) {
          logger.error('Error processing stock alerts:', error);
        }
      }, 60 * 60 * 1000); // 1 hour

      // Also run immediately
      this.processStockAlerts().catch(error => {
        logger.error('Error in initial stock alert processing:', error);
      });

      // Confirmation that the system is now active
      logger.info('✅ Smart Stock Alert System is now ACTIVE and monitoring');
      console.log('🧠 Smart Stock Alert System: ACTIVE - Monitoring stock levels and sending alerts to customers');
    } catch (error) {
      logger.error('Error starting monitoring service:', error);
      this.isRunning = false;
      throw error;
    }
  }

  // Stop the monitoring service
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Smart stock alert monitoring service stopped');
  }

  // Main method to process stock alerts
  async processStockAlerts() {
    try {
      logger.info('Processing stock alerts...');

      // Get all active stock alerts
      const stockAlerts = await StockAlert.find({ 
        isActive: true, 
        alertEnabled: true 
      }).populate(['customerId', 'outletId', 'productId']);

      logger.info(`Found ${stockAlerts.length} active stock alerts`);

      for (const alert of stockAlerts) {
        try {
          await this.processIndividualAlert(alert);
        } catch (error) {
          logger.error(`Error processing alert ${alert._id}:`, error);
        }
      }

      logger.info('Stock alert processing completed');
    } catch (error) {
      logger.error('Error in processStockAlerts:', error);
    }
  }

  // Process individual stock alert
  async processIndividualAlert(stockAlert) {
    const { customerId, outletId, productId } = stockAlert;

    // Skip if required data is missing
    if (!customerId || !outletId || !productId) {
      logger.warn(`Skipping alert ${stockAlert._id} - missing required data`);
      return;
    }

    // Update consumption patterns
    await this.updateConsumptionPatterns(stockAlert);

    // Calculate predicted run-out date
    const predictedRunOutDate = this.calculateRunOutDate(stockAlert);
    stockAlert.predictedRunOutDate = predictedRunOutDate;

    // Check if alert should be sent
    const shouldSendAlert = this.shouldSendAlert(stockAlert);
    
    if (shouldSendAlert) {
      await this.sendStockAlert(stockAlert);
    }

    // Save updated alert
    await stockAlert.save();
  }

  // Update consumption patterns based on order history
  async updateConsumptionPatterns(stockAlert) {
    try {
      // In a real implementation, you would analyze order history
      // For now, we'll use a simple algorithm based on last order
      
      const daysSinceLastOrder = Math.floor(
        (new Date() - stockAlert.lastOrderDate) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastOrder > 0) {
        // Calculate average consumption (bottles per week)
        const weeksSinceLastOrder = daysSinceLastOrder / 7;
        const averageConsumption = stockAlert.lastOrderQuantity / weeksSinceLastOrder;
        
        // Update with weighted average (70% new, 30% old)
        stockAlert.averageConsumption = 
          (averageConsumption * 0.7) + (stockAlert.averageConsumption * 0.3);
      }

      logger.info(`Updated consumption patterns for alert ${stockAlert._id}: ${stockAlert.averageConsumption} bottles/week`);
    } catch (error) {
      logger.error(`Error updating consumption patterns for alert ${stockAlert._id}:`, error);
    }
  }

  // Calculate when the customer will run out of stock
  calculateRunOutDate(stockAlert) {
    try {
      const currentStock = stockAlert.currentStockLevel;
      const averageConsumption = stockAlert.averageConsumption;

      if (averageConsumption <= 0) {
        // Default to 7 days if no consumption data
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      // Calculate days until run out
      const bottlesPerDay = averageConsumption / 7;
      const daysUntilRunOut = currentStock / bottlesPerDay;

      // Add buffer days (alert threshold)
      const adjustedDays = daysUntilRunOut - stockAlert.alertThreshold;

      const runOutDate = new Date(Date.now() + adjustedDays * 24 * 60 * 60 * 1000);

      logger.info(`Calculated run-out date for alert ${stockAlert._id}: ${runOutDate.toISOString()}`);

      return runOutDate;
    } catch (error) {
      logger.error(`Error calculating run-out date for alert ${stockAlert._id}:`, error);
      // Default to 7 days from now
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  // Determine if an alert should be sent
  shouldSendAlert(stockAlert) {
    try {
      const now = new Date();
      const predictedDate = stockAlert.predictedRunOutDate;

      if (!predictedDate) {
        return false;
      }

      // Check if we're within the alert threshold
      const daysUntilRunOut = Math.ceil((predictedDate - now) / (1000 * 60 * 60 * 24));
      const withinThreshold = daysUntilRunOut <= stockAlert.alertThreshold && daysUntilRunOut > 0;

      // Check if we haven't sent an alert recently (avoid spam)
      const lastAlertSent = stockAlert.lastAlertSent;
      const hoursSinceLastAlert = lastAlertSent ? 
        (now - lastAlertSent) / (1000 * 60 * 60) : 24;

      const shouldSend = withinThreshold && hoursSinceLastAlert >= 24;

      if (shouldSend) {
        logger.info(`Alert should be sent for ${stockAlert._id}: ${daysUntilRunOut} days until run-out`);
      }

      return shouldSend;
    } catch (error) {
      logger.error(`Error determining if alert should be sent for ${stockAlert._id}:`, error);
      return false;
    }
  }

  // Send stock alert notification
  async sendStockAlert(stockAlert) {
    try {
      const customer = stockAlert.customerId;
      const product = stockAlert.productId;
      const outlet = stockAlert.outletId;

      // Send notifications
      const results = await notificationService.sendStockAlert(
        customer, 
        stockAlert, 
        product, 
        outlet
      );

      // Update alert history
      stockAlert.lastAlertSent = new Date();
      stockAlert.alertHistory.push({
        date: new Date(),
        type: 'low_stock',
        message: `Stock alert sent for ${product.name}`,
        channel: Object.keys(results).join(', ')
      });

      // Keep only last 10 alerts in history
      if (stockAlert.alertHistory.length > 10) {
        stockAlert.alertHistory = stockAlert.alertHistory.slice(-10);
      }

      logger.info(`Stock alert sent for customer ${customer.name}, product ${product.name}`, results);

      return results;
    } catch (error) {
      logger.error(`Error sending stock alert for ${stockAlert._id}:`, error);
      throw error;
    }
  }

  // Create or update stock alert for a customer
  async createOrUpdateStockAlert(customerId, outletId, productId, currentStock = 0) {
    try {
      let stockAlert = await StockAlert.findOne({
        customerId,
        outletId,
        productId,
        isActive: true
      });

      if (!stockAlert) {
        // Create new stock alert
        stockAlert = new StockAlert({
          customerId,
          outletId,
          productId,
          currentStockLevel: currentStock,
          lastOrderDate: new Date(),
          lastOrderQuantity: currentStock
        });

        logger.info(`Created new stock alert for customer ${customerId}, product ${productId}`);
      } else {
        // Update existing stock alert
        stockAlert.currentStockLevel = currentStock;
        stockAlert.lastOrderDate = new Date();
        stockAlert.lastOrderQuantity = currentStock;

        logger.info(`Updated stock alert for customer ${customerId}, product ${productId}`);
      }

      await stockAlert.save();
      return stockAlert;
    } catch (error) {
      logger.error(`Error creating/updating stock alert:`, error);
      throw error;
    }
  }

  // Get stock alert statistics
  async getAlertStatistics() {
    try {
      const totalAlerts = await StockAlert.countDocuments({ isActive: true });
      const enabledAlerts = await StockAlert.countDocuments({ 
        isActive: true, 
        alertEnabled: true 
      });
      const alertsNeedingAttention = await StockAlert.countDocuments({
        isActive: true,
        alertEnabled: true,
        predictedRunOutDate: { $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
      });

      return {
        totalAlerts,
        enabledAlerts,
        alertsNeedingAttention,
        monitoringActive: this.isRunning
      };
    } catch (error) {
      logger.error('Error getting alert statistics:', error);
      throw error;
    }
  }

  // Update customer alert preferences
  async updateAlertPreferences(customerId, preferences) {
    try {
      const { alertEnabled, alertThreshold, preferredChannels } = preferences;

      const updatedAlerts = await StockAlert.updateMany(
        { customerId, isActive: true },
        {
          alertEnabled: alertEnabled !== undefined ? alertEnabled : true,
          alertThreshold: alertThreshold || 3,
          preferredChannels: preferredChannels || { email: true, whatsapp: true }
        }
      );

      logger.info(`Updated alert preferences for customer ${customerId}: ${updatedAlerts.modifiedCount} alerts updated`);
      return updatedAlerts;
    } catch (error) {
      logger.error(`Error updating alert preferences for customer ${customerId}:`, error);
      throw error;
    }
  }

  // Manual trigger for testing
  async triggerTestAlert(customerId, productId, outletId) {
    try {
      const customer = await User.findById(customerId);
      const product = await Product.findById(productId);
      const outlet = await Outlet.findById(outletId);

      if (!customer || !product || !outlet) {
        throw new Error('Customer, product, or outlet not found');
      }

      // Create a test stock alert
      const testAlert = new StockAlert({
        customerId,
        outletId,
        productId,
        currentStockLevel: 2,
        averageConsumption: 5, // 5 bottles per week
        alertThreshold: 3,
        predictedRunOutDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      });

      // Send test notification
      const results = await notificationService.sendStockAlert(
        customer,
        testAlert,
        product,
        outlet
      );

      logger.info(`Test alert sent for customer ${customer.name}`, results);
      return results;
    } catch (error) {
      logger.error('Error triggering test alert:', error);
      throw error;
    }
  }
}

export default new SmartStockAlertService();
