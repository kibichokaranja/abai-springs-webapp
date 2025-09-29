import CustomerStock from '../models/CustomerStock.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
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

class ConsumptionTracker {
  constructor() {
    this.isRunning = false;
  }

  // Main method to process new order and update customer stock
  async processNewOrder(order) {
    try {
      console.log('🧠 Processing new order for consumption tracking:', order._id);
      
      // Extract customer information
      const customerInfo = this.extractCustomerInfo(order);
      
      if (!customerInfo.email) {
        console.log('⚠️ No customer email found, skipping consumption tracking');
        return;
      }
      
      // Process each item in the order
      const orderItems = order.items.map(item => ({
        product: item.product._id || item.product,
        productName: item.product.name || 'Unknown Product',
        quantity: item.quantity,
        orderId: order._id
      }));
      
      // Create or update customer stock records
      const customerStockRecords = await CustomerStock.createOrUpdateCustomerStock(
        customerInfo,
        orderItems
      );
      
      console.log(`✅ Updated customer stock for ${customerStockRecords.length} products`);
      
      // Check for customers needing alerts
      await this.checkAndSendAlerts();
      
      return customerStockRecords;
      
    } catch (error) {
      logger.error('Error processing new order for consumption tracking:', error);
      console.log('❌ Error in consumption tracking:', error.message);
    }
  }

  // Extract customer information from order
  extractCustomerInfo(order) {
    let customerInfo = {
      userId: order.customer?._id || order.customer || null,
      email: null,
      phone: null,
      name: 'Valued Customer'
    };
    
    // Try to get from customer object first
    if (order.customer) {
      customerInfo.email = order.customer.email;
      customerInfo.phone = order.customer.phone;
      customerInfo.name = order.customer.name || customerInfo.name;
    }
    
    // If not found, try to extract from notes
    if (!customerInfo.email && order.notes) {
      const emailMatch = order.notes.match(/Email:\s*([^\s,]+)/i);
      if (emailMatch && emailMatch[1] !== 'Not provided') {
        customerInfo.email = emailMatch[1];
      }
      
      const phoneMatch = order.notes.match(/Phone:\s*([^\s,]+)/i);
      if (phoneMatch) {
        customerInfo.phone = phoneMatch[1];
      }
      
      const nameMatch = order.notes.match(/Customer:\s*([^,]+)/i);
      if (nameMatch) {
        customerInfo.name = nameMatch[1].trim();
      }
    }
    
    return customerInfo;
  }

  // Check for customers needing alerts and send them
  async checkAndSendAlerts() {
    try {
      console.log('🔍 Checking for customers needing stock alerts...');
      
      const customersNeedingAlerts = await CustomerStock.findCustomersNeedingAlerts();
      
      console.log(`📊 Found ${customersNeedingAlerts.length} customers needing alerts`);
      
      for (const customerStock of customersNeedingAlerts) {
        await this.sendStockAlert(customerStock);
      }
      
    } catch (error) {
      logger.error('Error checking and sending alerts:', error);
      console.log('❌ Error in alert checking:', error.message);
    }
  }

  // Send stock alert to customer
  async sendStockAlert(customerStock) {
    try {
      // Update alert level
      customerStock.updateAlertLevel();
      
      // Check if alert should be sent
      if (!customerStock.shouldSendAlert()) {
        return;
      }
      
      console.log(`🚨 Sending stock alert to ${customerStock.customerName} for ${customerStock.productName}`);
      
      // Import notification service dynamically to avoid circular imports
      const { default: notificationService } = await import('./notificationService.js');
      
      // Generate personalized alert message
      const alertData = {
        customerName: customerStock.customerName,
        customerEmail: customerStock.customerEmail,
        customerPhone: customerStock.customerPhone,
        productName: customerStock.productName,
        currentStock: customerStock.currentStock,
        alertLevel: customerStock.alertLevel,
        daysUntilRunOut: customerStock.daysUntilRunOut,
        consumptionRate: customerStock.consumptionRate,
        averageOrderSize: customerStock.averageOrderSize
      };
      
      // Send personalized stock alert
      const result = await notificationService.sendPersonalizedStockAlert(alertData);
      
      if (result.success) {
        // Update last alert sent time
        customerStock.lastAlertSent = new Date();
        await customerStock.save();
        
        console.log(`✅ Stock alert sent successfully to ${customerStock.customerEmail}`);
      } else {
        console.log(`❌ Failed to send stock alert to ${customerStock.customerEmail}:`, result.error);
      }
      
    } catch (error) {
      logger.error('Error sending stock alert:', error);
      console.log('❌ Error sending stock alert:', error.message);
    }
  }

  // Daily consumption update (simulate consumption)
  async updateDailyConsumption() {
    try {
      console.log('📅 Updating daily consumption for all customers...');
      
      const activeCustomerStocks = await CustomerStock.find({
        isActive: true,
        currentStock: { $gt: 0 },
        consumptionRate: { $gt: 0 }
      });
      
      for (const customerStock of activeCustomerStocks) {
        // Simulate daily consumption
        const dailyConsumption = Math.min(customerStock.consumptionRate, customerStock.currentStock);
        
        if (dailyConsumption > 0) {
          customerStock.currentStock -= dailyConsumption;
          customerStock.updatePredictedRunOutDate();
          customerStock.updateAlertLevel();
          
          await customerStock.save();
          
          // Check if alert should be sent after consumption update
          if (customerStock.shouldSendAlert()) {
            await this.sendStockAlert(customerStock);
          }
        }
      }
      
      console.log(`✅ Updated consumption for ${activeCustomerStocks.length} customers`);
      
    } catch (error) {
      logger.error('Error updating daily consumption:', error);
      console.log('❌ Error in daily consumption update:', error.message);
    }
  }

  // Get customer consumption insights
  async getCustomerInsights(customerEmail) {
    try {
      const customerStocks = await CustomerStock.find({
        customerEmail: customerEmail,
        isActive: true
      }).populate('product');
      
      const insights = {
        totalProducts: customerStocks.length,
        totalCurrentStock: customerStocks.reduce((sum, stock) => sum + stock.currentStock, 0),
        averageConsumptionRate: customerStocks.reduce((sum, stock) => sum + stock.consumptionRate, 0) / customerStocks.length,
        productsNeedingRestock: customerStocks.filter(stock => stock.alertLevel !== 'none'),
        consumptionPatterns: customerStocks.map(stock => ({
          productName: stock.productName,
          currentStock: stock.currentStock,
          consumptionRate: stock.consumptionRate,
          daysUntilRunOut: stock.daysUntilRunOut,
          alertLevel: stock.alertLevel
        }))
      };
      
      return insights;
      
    } catch (error) {
      logger.error('Error getting customer insights:', error);
      return null;
    }
  }

  // Start daily consumption simulation (for testing)
  startDailySimulation() {
    if (this.isRunning) {
      console.log('⚠️ Daily consumption simulation already running');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 Starting daily consumption simulation...');
    
    // Run every 24 hours
    setInterval(async () => {
      await this.updateDailyConsumption();
    }, 24 * 60 * 60 * 1000);
    
    // Also run immediately for testing
    setTimeout(async () => {
      await this.updateDailyConsumption();
    }, 5000); // 5 seconds delay
  }

  // Stop daily consumption simulation
  stopDailySimulation() {
    this.isRunning = false;
    console.log('⏹️ Daily consumption simulation stopped');
  }
}

export default new ConsumptionTracker();




















