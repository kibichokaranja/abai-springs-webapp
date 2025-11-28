import dotenv from 'dotenv';
import notificationService from './services/notificationService.js';

// Load environment variables
dotenv.config({ path: './config.env' });

console.log('🧪 Testing Staff Email Notification System');
console.log('==========================================\n');

async function testStaffEmailNotifications() {
  try {
    console.log('📧 Testing Owner Daily Insights Email...\n');
    
    // Test Owner Daily Insights
    const ownerInsights = {
      ownerEmail: 'owner@abaisprings.com',
      ownerName: 'John Mwangi',
      totalRevenue: 125000,
      totalOrders: 45,
      topProducts: [
        { name: '20L Premium Water', sales: 25 },
        { name: '5L Family Pack', sales: 18 },
        { name: '1L Personal', sales: 12 }
      ],
      lowStockItems: [
        { name: '500ml Bottles', quantity: 15, urgency: 'critical' },
        { name: '20L Dispensers', quantity: 8, urgency: 'high' }
      ],
      customerGrowth: 12.5,
      driverPerformance: [
        { name: 'Peter Kamau', deliveries: 15, rating: 4.8 },
        { name: 'Mary Wanjiku', deliveries: 12, rating: 4.9 }
      ],
      salesPerformance: [
        { name: 'James Kiprop', achievement: 95 },
        { name: 'Grace Muthoni', achievement: 87 }
      ],
      warehouseEfficiency: 92.5
    };

    const ownerResult = await notificationService.sendOwnerDailyInsights(ownerInsights);
    console.log('✅ Owner Daily Insights Result:', ownerResult);

    console.log('\n🚚 Testing Driver Delivery Assignment Email...\n');
    
    // Test Driver Delivery Assignment
    const deliveryData = {
      driverEmail: 'driver@abaisprings.com',
      driverName: 'Peter Kamau',
      orderNumber: 'AS-2024-001234',
      customerName: 'Jane Wanjiku',
      deliveryAddress: '123 Kileleshwa Lane, Nairobi, Kenya',
      deliveryTime: '2:00 PM - 4:00 PM',
      items: [
        { name: '20L Premium Water', quantity: 2 },
        { name: '5L Family Pack', quantity: 4 }
      ],
      specialInstructions: 'Call customer 30 minutes before arrival. Use back entrance.',
      estimatedDuration: '45 minutes',
      routeOptimization: 'Traffic-optimized route via Ring Road'
    };

    const driverResult = await notificationService.sendDriverDeliveryAssignment(deliveryData);
    console.log('✅ Driver Delivery Assignment Result:', driverResult);

    console.log('\n🎯 Testing Sales Lead Notification Email...\n');
    
    // Test Sales Lead Notification
    const leadData = {
      salespersonEmail: 'sales@abaisprings.com',
      salespersonName: 'James Kiprop',
      leadName: 'Tech Solutions Ltd',
      leadEmail: 'procurement@techsolutions.co.ke',
      leadPhone: '+254 700 123 456',
      leadSource: 'Website Contact Form',
      leadScore: 85,
      interestLevel: 78,
      estimatedValue: 250000,
      territory: 'Nairobi Central',
      followUpDate: 'Tomorrow at 10:00 AM',
      notes: 'Interested in bulk office water supply. Company has 200+ employees. Previous supplier issues with delivery reliability.'
    };

    const salesResult = await notificationService.sendSalesLeadNotification(leadData);
    console.log('✅ Sales Lead Notification Result:', salesResult);

    console.log('\n🏭 Testing Warehouse Inventory Alert Email...\n');
    
    // Test Warehouse Inventory Alert
    const alertData = {
      warehouseEmail: 'warehouse@abaisprings.com',
      warehouseStaff: 'Warehouse Team',
      alertType: 'Critical Stock Shortage',
      priority: 'critical',
      actionRequired: 'Immediate restocking required',
      estimatedImpact: 'Potential order delays affecting 15+ customers',
      items: [
        { 
          name: '500ml Bottles', 
          currentStock: 15, 
          minimumRequired: 200,
          status: 'Critical',
          critical: true,
          estimatedDaysLeft: 1
        },
        { 
          name: '20L Dispensers', 
          currentStock: 8, 
          minimumRequired: 50,
          status: 'Low',
          critical: false,
          estimatedDaysLeft: 3
        }
      ],
      recommendations: 'Contact primary supplier immediately. Consider emergency order from secondary supplier to maintain service levels.',
      supplierInfo: {
        name: 'AquaPure Supplies Ltd',
        contact: '+254 700 999 888',
        leadTime: '2-3 business days',
        minimumOrder: '500 units'
      }
    };

    const warehouseResult = await notificationService.sendWarehouseInventoryAlert(alertData);
    console.log('✅ Warehouse Inventory Alert Result:', warehouseResult);

    console.log('\n🎉 All Staff Email Notification Tests Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('• Owner Daily Insights: ✅ Sent');
    console.log('• Driver Delivery Assignment: ✅ Sent');
    console.log('• Sales Lead Notification: ✅ Sent');
    console.log('• Warehouse Inventory Alert: ✅ Sent');

  } catch (error) {
    console.error('❌ Error testing staff email notifications:', error);
  }
}

// Run the tests
testStaffEmailNotifications();




































