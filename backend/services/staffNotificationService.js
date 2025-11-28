import notificationService from './notificationService.js';
import Staff from '../models/Staff.js';
import Driver from '../models/Driver.js';
import Salesperson from '../models/Salesperson.js';
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

class StaffNotificationService {
  constructor() {
    this.scheduledNotifications = new Map();
  }

  // Send daily business insights to owner
  async sendDailyOwnerInsights() {
    try {
      // Get owner/staff with admin role
      const owners = await Staff.find({ role: 'admin', status: 'active' });
      
      if (owners.length === 0) {
        logger.warn('No active owners found for daily insights');
        return { success: false, error: 'No owners found' };
      }

      // Generate mock business data (in real app, this would come from your analytics)
      const businessData = await this.generateDailyBusinessData();

      const results = [];
      for (const owner of owners) {
        const insights = {
          ownerEmail: owner.email,
          ownerName: owner.name,
          ...businessData
        };

        const result = await notificationService.sendOwnerDailyInsights(insights);
        results.push({ owner: owner.email, result });
      }

      logger.info('Daily owner insights sent', { results });
      return { success: true, results };

    } catch (error) {
      logger.error('Error sending daily owner insights:', error);
      return { success: false, error: error.message };
    }
  }

  // Send delivery assignment to driver
  async sendDeliveryAssignment(order, driverId) {
    try {
      const driver = await Driver.findById(driverId);
      if (!driver) {
        logger.error('Driver not found for delivery assignment', { driverId });
        return { success: false, error: 'Driver not found' };
      }

      const deliveryData = {
        driverEmail: driver.email,
        driverName: driver.name,
        orderNumber: order.orderNumber || order._id,
        customerName: order.customerName || 'Customer',
        deliveryAddress: order.deliveryAddress || order.address,
        deliveryTime: order.deliveryTime || '9:00 AM - 5:00 PM',
        items: order.items || [],
        specialInstructions: order.deliveryInstructions || order.notes,
        estimatedDuration: '30-45 minutes',
        routeOptimization: 'AI-optimized route'
      };

      const result = await notificationService.sendDriverDeliveryAssignment(deliveryData);
      logger.info('Delivery assignment sent to driver', { driverId, result });
      return result;

    } catch (error) {
      logger.error('Error sending delivery assignment:', error);
      return { success: false, error: error.message };
    }
  }

  // Send sales lead notification to salesperson
  async sendSalesLeadNotification(lead, salespersonId) {
    try {
      const salesperson = await Salesperson.findById(salespersonId);
      if (!salesperson) {
        logger.error('Salesperson not found for lead notification', { salespersonId });
        return { success: false, error: 'Salesperson not found' };
      }

      const leadData = {
        salespersonEmail: salesperson.email,
        salespersonName: salesperson.name,
        leadName: lead.name || lead.companyName,
        leadEmail: lead.email,
        leadPhone: lead.phone,
        leadSource: lead.source || 'Website',
        leadScore: lead.score || Math.floor(Math.random() * 40) + 60, // 60-100
        interestLevel: lead.interestLevel || Math.floor(Math.random() * 30) + 70, // 70-100
        estimatedValue: lead.estimatedValue || 50000,
        territory: salesperson.territory,
        followUpDate: lead.followUpDate || 'Within 24 hours',
        notes: lead.notes || 'High-quality lead requiring immediate attention'
      };

      const result = await notificationService.sendSalesLeadNotification(leadData);
      logger.info('Sales lead notification sent', { salespersonId, result });
      return result;

    } catch (error) {
      logger.error('Error sending sales lead notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send warehouse inventory alert
  async sendWarehouseInventoryAlert(alertType, items, priority = 'medium') {
    try {
      // Get warehouse staff
      const warehouseStaff = await Staff.find({ 
        $or: [
          { role: 'warehouse' },
          { department: 'operations' }
        ], 
        status: 'active' 
      });

      if (warehouseStaff.length === 0) {
        logger.warn('No warehouse staff found for inventory alert');
        return { success: false, error: 'No warehouse staff found' };
      }

      const alertData = {
        warehouseEmail: warehouseStaff[0].email, // Send to first warehouse staff
        warehouseStaff: 'Warehouse Team',
        alertType,
        priority,
        actionRequired: this.getActionRequired(alertType, priority),
        estimatedImpact: this.getEstimatedImpact(alertType, items),
        items,
        recommendations: this.getRecommendations(alertType, priority),
        supplierInfo: {
          name: 'AquaPure Supplies Ltd',
          contact: '+254 700 999 888',
          leadTime: '2-3 business days',
          minimumOrder: '100 units'
        }
      };

      const result = await notificationService.sendWarehouseInventoryAlert(alertData);
      logger.info('Warehouse inventory alert sent', { alertType, priority, result });
      return result;

    } catch (error) {
      logger.error('Error sending warehouse inventory alert:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate mock daily business data
  async generateDailyBusinessData() {
    // In a real application, this would query your database for actual metrics
    return {
      totalRevenue: Math.floor(Math.random() * 100000) + 50000,
      totalOrders: Math.floor(Math.random() * 50) + 20,
      topProducts: [
        { name: '20L Premium Water', sales: Math.floor(Math.random() * 30) + 15 },
        { name: '5L Family Pack', sales: Math.floor(Math.random() * 25) + 10 },
        { name: '1L Personal', sales: Math.floor(Math.random() * 20) + 5 }
      ],
      lowStockItems: [
        { name: '500ml Bottles', quantity: Math.floor(Math.random() * 20) + 5, urgency: 'high' },
        { name: '20L Dispensers', quantity: Math.floor(Math.random() * 15) + 3, urgency: 'medium' }
      ],
      customerGrowth: Math.floor(Math.random() * 20) + 5,
      driverPerformance: [
        { name: 'Peter Kamau', deliveries: Math.floor(Math.random() * 20) + 10, rating: 4.5 + Math.random() * 0.5 },
        { name: 'Mary Wanjiku', deliveries: Math.floor(Math.random() * 18) + 8, rating: 4.3 + Math.random() * 0.7 }
      ],
      salesPerformance: [
        { name: 'James Kiprop', achievement: Math.floor(Math.random() * 30) + 70 },
        { name: 'Grace Muthoni', achievement: Math.floor(Math.random() * 25) + 75 }
      ],
      warehouseEfficiency: Math.floor(Math.random() * 20) + 80
    };
  }

  // Get action required based on alert type and priority
  getActionRequired(alertType, priority) {
    const actions = {
      'Critical Stock Shortage': 'Immediate restocking required',
      'Low Stock Alert': 'Schedule restocking within 24 hours',
      'Supplier Delay': 'Contact alternative suppliers',
      'Quality Issue': 'Quarantine affected items and investigate',
      'Equipment Failure': 'Schedule maintenance or replacement'
    };
    return actions[alertType] || 'Review and take appropriate action';
  }

  // Get estimated impact based on alert type and items
  getEstimatedImpact(alertType, items) {
    const itemCount = items ? items.length : 0;
    return `Potential impact on ${itemCount} items and ${Math.floor(Math.random() * 20) + 5} pending orders`;
  }

  // Get recommendations based on alert type and priority
  getRecommendations(alertType, priority) {
    if (priority === 'critical') {
      return 'Immediate action required. Contact suppliers immediately and consider emergency protocols.';
    } else if (priority === 'high') {
      return 'Urgent attention needed. Schedule emergency restocking and notify affected departments.';
    } else {
      return 'Monitor closely and schedule regular restocking to prevent future shortages.';
    }
  }

  // Schedule daily owner insights (call this from a cron job or scheduler)
  scheduleDailyOwnerInsights() {
    // This would typically be called by a cron job
    const dailyInsightTime = new Date();
    dailyInsightTime.setHours(8, 0, 0, 0); // 8:00 AM daily

    const timeUntilNext = dailyInsightTime.getTime() - Date.now();
    if (timeUntilNext < 0) {
      dailyInsightTime.setDate(dailyInsightTime.getDate() + 1);
    }

    const timeoutId = setTimeout(() => {
      this.sendDailyOwnerInsights();
      this.scheduleDailyOwnerInsights(); // Schedule next day
    }, dailyInsightTime.getTime() - Date.now());

    this.scheduledNotifications.set('dailyOwnerInsights', timeoutId);
    logger.info('Daily owner insights scheduled', { nextRun: dailyInsightTime });
  }

  // Cancel scheduled notifications
  cancelScheduledNotifications() {
    for (const [name, timeoutId] of this.scheduledNotifications) {
      clearTimeout(timeoutId);
      logger.info('Cancelled scheduled notification', { name });
    }
    this.scheduledNotifications.clear();
  }

  // Trigger notifications based on business events
  async triggerNotification(eventType, data) {
    try {
      switch (eventType) {
        case 'new_order':
          // Send delivery assignment to assigned driver
          if (data.driverId) {
            await this.sendDeliveryAssignment(data.order, data.driverId);
          }
          break;

        case 'new_lead':
          // Send lead notification to assigned salesperson
          if (data.salespersonId) {
            await this.sendSalesLeadNotification(data.lead, data.salespersonId);
          }
          break;

        case 'low_stock':
          // Send warehouse alert
          await this.sendWarehouseInventoryAlert(
            'Low Stock Alert',
            data.items,
            data.priority || 'medium'
          );
          break;

        case 'critical_stock':
          // Send critical warehouse alert
          await this.sendWarehouseInventoryAlert(
            'Critical Stock Shortage',
            data.items,
            'critical'
          );
          break;

        case 'daily_insights':
          // Send daily owner insights
          await this.sendDailyOwnerInsights();
          break;

        default:
          logger.warn('Unknown notification event type', { eventType });
          return { success: false, error: 'Unknown event type' };
      }

      logger.info('Notification triggered successfully', { eventType });
      return { success: true };

    } catch (error) {
      logger.error('Error triggering notification:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new StaffNotificationService();




































