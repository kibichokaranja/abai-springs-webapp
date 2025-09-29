import User from '../models/User.js';
import Order from '../models/Order.js';
import OutletInventory from '../models/OutletInventory.js';
import Newsletter from '../models/Newsletter.js';
import { logger } from '../utils/logger.js';

class AIStockMonitor {
  constructor() {
    this.alertThresholds = {
      lowStock: 0.2, // 20% of normal stock
      criticalStock: 0.1, // 10% of normal stock
      reorderPoint: 0.3 // 30% of normal stock
    };
    
    this.consumptionPatterns = new Map();
    this.customerPreferences = new Map();
  }

  // Analyze customer consumption patterns
  async analyzeConsumptionPatterns() {
    try {
      logger.info('Starting consumption pattern analysis');
      
      const orders = await Order.find({ status: 'delivered' })
        .populate('user')
        .populate('items.product')
        .sort({ createdAt: -1 })
        .limit(1000);

      const patterns = {};
      
      orders.forEach(order => {
        const userId = order.user._id.toString();
        if (!patterns[userId]) {
          patterns[userId] = {
            totalOrders: 0,
            totalQuantity: 0,
            averageOrderSize: 0,
            lastOrderDate: null,
            preferredProducts: {},
            orderFrequency: 0
          };
        }

        patterns[userId].totalOrders++;
        patterns[userId].totalQuantity += order.items.reduce((sum, item) => sum + item.quantity, 0);
        patterns[userId].lastOrderDate = order.createdAt;
        
        // Track preferred products
        order.items.forEach(item => {
          const productId = item.product._id.toString();
          if (!patterns[userId].preferredProducts[productId]) {
            patterns[userId].preferredProducts[productId] = 0;
          }
          patterns[userId].preferredProducts[productId] += item.quantity;
        });
      });

      // Calculate averages and frequencies
      Object.keys(patterns).forEach(userId => {
        const pattern = patterns[userId];
        pattern.averageOrderSize = pattern.totalQuantity / pattern.totalOrders;
        
        // Calculate order frequency (orders per month)
        const daysSinceFirstOrder = (Date.now() - pattern.lastOrderDate) / (1000 * 60 * 60 * 24);
        pattern.orderFrequency = pattern.totalOrders / (daysSinceFirstOrder / 30);
      });

      this.consumptionPatterns = new Map(Object.entries(patterns));
      logger.info(`Analyzed consumption patterns for ${patterns.length} customers`);
      
      return patterns;
    } catch (error) {
      logger.error('Error analyzing consumption patterns:', error);
      throw error;
    }
  }

  // Predict when customers will need to reorder
  async predictReorderNeeds() {
    try {
      const predictions = [];
      const now = new Date();
      
      for (const [userId, pattern] of this.consumptionPatterns) {
        const daysSinceLastOrder = (now - pattern.lastOrderDate) / (1000 * 60 * 60 * 24);
        const expectedReorderDate = pattern.lastOrderDate.getTime() + (30 / pattern.orderFrequency) * 24 * 60 * 60 * 1000;
        const daysUntilReorder = (expectedReorderDate - now) / (1000 * 60 * 60 * 24);
        
        if (daysUntilReorder <= 7) { // Customer likely needs to reorder within a week
          predictions.push({
            userId,
            pattern,
            daysUntilReorder,
            urgency: daysUntilReorder <= 3 ? 'high' : daysUntilReorder <= 7 ? 'medium' : 'low'
          });
        }
      }
      
      return predictions;
    } catch (error) {
      logger.error('Error predicting reorder needs:', error);
      throw error;
    }
  }

  // Check stock levels and generate alerts
  async checkStockLevels() {
    try {
      logger.info('Checking stock levels across all outlets');
      
      const inventory = await OutletInventory.find({ isActive: true })
        .populate('outlet')
        .populate('product');
      
      const stockAlerts = [];
      
      inventory.forEach(item => {
        const stockPercentage = item.stockLevel / (item.stockLevel + item.reservedStock);
        
        if (stockPercentage <= this.alertThresholds.criticalStock) {
          stockAlerts.push({
            type: 'critical',
            outlet: item.outlet,
            product: item.product,
            currentStock: item.stockLevel,
            stockPercentage,
            message: `Critical stock alert: ${item.product.name} at ${item.outlet.name} is running very low (${Math.round(stockPercentage * 100)}%)`
          });
        } else if (stockPercentage <= this.alertThresholds.lowStock) {
          stockAlerts.push({
            type: 'low',
            outlet: item.outlet,
            product: item.product,
            currentStock: item.stockLevel,
            stockPercentage,
            message: `Low stock alert: ${item.product.name} at ${item.outlet.name} is running low (${Math.round(stockPercentage * 100)}%)`
          });
        }
      });
      
      logger.info(`Generated ${stockAlerts.length} stock alerts`);
      return stockAlerts;
    } catch (error) {
      logger.error('Error checking stock levels:', error);
      throw error;
    }
  }

  // Generate personalized reorder suggestions
  async generateReorderSuggestions() {
    try {
      const predictions = await this.predictReorderNeeds();
      const suggestions = [];
      
      for (const prediction of predictions) {
        const user = await User.findById(prediction.userId);
        if (!user) continue;
        
        const preferredProducts = Object.entries(prediction.pattern.preferredProducts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3); // Top 3 preferred products
        
        const suggestion = {
          userId: prediction.userId,
          user: {
            name: user.name,
            email: user.email,
            phone: user.phone
          },
          urgency: prediction.urgency,
          daysUntilReorder: prediction.daysUntilReorder,
          suggestedProducts: preferredProducts.map(([productId, quantity]) => ({
            productId,
            quantity: Math.ceil(quantity / prediction.pattern.totalOrders) // Average quantity per order
          })),
          message: this.generatePersonalizedMessage(prediction, user)
        };
        
        suggestions.push(suggestion);
      }
      
      return suggestions;
    } catch (error) {
      logger.error('Error generating reorder suggestions:', error);
      throw error;
    }
  }

  // Generate personalized messages for customers
  generatePersonalizedMessage(prediction, user) {
    const urgency = prediction.urgency;
    const daysUntilReorder = prediction.daysUntilReorder;
    
    let message = `Hi ${user.name}! 👋\n\n`;
    
    if (urgency === 'high') {
      message += `🚨 **Urgent Reorder Alert** 🚨\n\n`;
      message += `It looks like you might be running low on your Abai Springs water! `;
      message += `Based on your consumption pattern, you typically reorder every ${Math.round(30 / prediction.pattern.orderFrequency)} days. `;
      message += `It's been ${Math.round((Date.now() - prediction.pattern.lastOrderDate) / (1000 * 60 * 60 * 24))} days since your last order.\n\n`;
      message += `💧 **Don't run out of pure Mt. Kenya water!**\n\n`;
      message += `Order now to ensure uninterrupted hydration for you and your family. `;
      message += `We offer fast delivery and your favorite products are in stock!\n\n`;
      message += `🎁 **Special Offer**: Use code REORDER10 for 10% off your next order!\n\n`;
    } else if (urgency === 'medium') {
      message += `💧 **Smart Reorder Reminder** 💧\n\n`;
      message += `Just a friendly reminder that you might want to reorder your Abai Springs water soon. `;
      message += `Based on your consumption pattern, you typically reorder every ${Math.round(30 / prediction.pattern.orderFrequency)} days.\n\n`;
      message += `🌊 **Stay hydrated with pure Mt. Kenya water!**\n\n`;
      message += `Order now to avoid running out. We'll deliver fresh water right to your doorstep!\n\n`;
      message += `🎁 **Limited Time**: Use code REORDER5 for 5% off your next order!\n\n`;
    } else {
      message += `💧 **Friendly Reorder Reminder** 💧\n\n`;
      message += `Hope you're enjoying your Abai Springs water! `;
      message += `Just a gentle reminder that you might want to reorder soon.\n\n`;
      message += `🌊 **Pure Mt. Kenya water for your family**\n\n`;
      message += `We're here to keep you hydrated with the freshest water available!\n\n`;
    }
    
    message += `📱 **Quick Order**: Reply with "ORDER" to place your usual order\n`;
    message += `🌐 **Online**: Visit our website for more options\n`;
    message += `📞 **Call**: 0712345678 for personalized assistance\n\n`;
    message += `Thank you for choosing Abai Springs! 💙\n`;
    message += `- Your Abai Springs Team`;
    
    return message;
  }

  // Send smart alerts to customers
  async sendSmartAlerts() {
    try {
      logger.info('Starting smart alert system');
      
      // Analyze patterns and generate suggestions
      await this.analyzeConsumptionPatterns();
      const suggestions = await this.generateReorderSuggestions();
      
      // Get newsletter subscribers for broader communication
      const newsletterSubscribers = await Newsletter.find({ 
        isActive: true,
        'preferences.emailUpdates': true 
      });
      
      const alerts = [];
      
      // Process reorder suggestions
      for (const suggestion of suggestions) {
        const alert = {
          type: 'reorder_suggestion',
          userId: suggestion.userId,
          user: suggestion.user,
          urgency: suggestion.urgency,
          message: suggestion.message,
          channels: this.determineChannels(suggestion.user),
          timestamp: new Date()
        };
        
        alerts.push(alert);
      }
      
      // Process stock alerts for newsletter subscribers
      const stockAlerts = await this.checkStockLevels();
      if (stockAlerts.length > 0) {
        const stockAlertMessage = this.generateStockAlertMessage(stockAlerts);
        
        for (const subscriber of newsletterSubscribers) {
          const alert = {
            type: 'stock_alert',
            userId: subscriber._id,
            user: {
              name: subscriber.name || 'Valued Customer',
              email: subscriber.email,
              phone: subscriber.phone
            },
            urgency: 'medium',
            message: stockAlertMessage,
            channels: this.determineChannels(subscriber),
            timestamp: new Date()
          };
          
          alerts.push(alert);
        }
      }
      
      logger.info(`Generated ${alerts.length} smart alerts`);
      return alerts;
    } catch (error) {
      logger.error('Error sending smart alerts:', error);
      throw error;
    }
  }

  // Determine best communication channels for each user
  determineChannels(user) {
    const channels = [];
    
    if (user.email) {
      channels.push('email');
    }
    
    if (user.phone) {
      channels.push('whatsapp');
    }
    
    // Default to email if no other channels available
    if (channels.length === 0) {
      channels.push('email');
    }
    
    return channels;
  }

  // Generate stock alert message for newsletter subscribers
  generateStockAlertMessage(stockAlerts) {
    let message = `🌊 **Abai Springs Stock Update** 🌊\n\n`;
    message += `Dear valued customer,\n\n`;
    message += `We wanted to let you know about current stock levels at our outlets:\n\n`;
    
    const criticalAlerts = stockAlerts.filter(alert => alert.type === 'critical');
    const lowAlerts = stockAlerts.filter(alert => alert.type === 'low');
    
    if (criticalAlerts.length > 0) {
      message += `🚨 **Critical Stock Alerts:**\n`;
      criticalAlerts.forEach(alert => {
        message += `• ${alert.product.name} at ${alert.outlet.name} - ${Math.round(alert.stockPercentage * 100)}% remaining\n`;
      });
      message += `\n`;
    }
    
    if (lowAlerts.length > 0) {
      message += `⚠️ **Low Stock Alerts:**\n`;
      lowAlerts.forEach(alert => {
        message += `• ${alert.product.name} at ${alert.outlet.name} - ${Math.round(alert.stockPercentage * 100)}% remaining\n`;
      });
      message += `\n`;
    }
    
    message += `💡 **Recommendation**: Order soon to ensure availability of your preferred products!\n\n`;
    message += `🌐 **Order Online**: Visit our website for real-time stock updates\n`;
    message += `📞 **Call Us**: 0712345678 for assistance\n`;
    message += `📱 **WhatsApp**: Send us a message for quick ordering\n\n`;
    message += `Thank you for choosing Abai Springs! 💙\n`;
    message += `- Your Abai Springs Team`;
    
    return message;
  }

  // Schedule regular monitoring
  scheduleMonitoring() {
    // Run consumption analysis daily at 2 AM
    setInterval(async () => {
      try {
        await this.sendSmartAlerts();
        logger.info('Scheduled smart alerts completed successfully');
      } catch (error) {
        logger.error('Error in scheduled smart alerts:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    // Run stock level checks every 6 hours
    setInterval(async () => {
      try {
        await this.checkStockLevels();
        logger.info('Scheduled stock level check completed successfully');
      } catch (error) {
        logger.error('Error in scheduled stock level check:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours
    
    logger.info('AI Stock Monitor scheduled successfully');
  }
}

export default new AIStockMonitor();











