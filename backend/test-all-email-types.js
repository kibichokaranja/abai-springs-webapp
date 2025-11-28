import dotenv from 'dotenv';
import notificationService from './services/notificationService.js';

// Load environment variables
dotenv.config({ path: './config.env' });

console.log('🧪 Complete Email Notification Test Suite');
console.log('==========================================\n');

async function testAllEmailTypes() {
  const results = [];
  
  try {
    // Test 1: Owner Daily Insights
    console.log('1️⃣ Testing Owner Daily Insights...');
    const ownerResult = await notificationService.sendOwnerDailyInsights({
      ownerEmail: 'owner@abaisprings.com',
      ownerName: 'John Mwangi',
      totalRevenue: 150000,
      totalOrders: 52,
      topProducts: [
        { name: '20L Premium Water', sales: 30 },
        { name: '5L Family Pack', sales: 22 }
      ],
      lowStockItems: [
        { name: '500ml Bottles', quantity: 12, urgency: 'critical' }
      ],
      customerGrowth: 15.2,
      driverPerformance: [
        { name: 'Peter Kamau', deliveries: 18, rating: 4.9 }
      ],
      salesPerformance: [
        { name: 'James Kiprop', achievement: 98 }
      ],
      warehouseEfficiency: 94.5
    });
    results.push({ type: 'Owner Insights', success: ownerResult.success });
    console.log('   ✅ Owner Insights:', ownerResult.success ? 'SUCCESS' : 'FAILED');

    // Test 2: Driver Delivery Assignment
    console.log('\n2️⃣ Testing Driver Delivery Assignment...');
    const driverResult = await notificationService.sendDriverDeliveryAssignment({
      driverEmail: 'driver@abaisprings.com',
      driverName: 'Peter Kamau',
      orderNumber: 'AS-2024-001235',
      customerName: 'Jane Wanjiku',
      deliveryAddress: '456 Karen Road, Nairobi, Kenya',
      deliveryTime: '3:00 PM - 5:00 PM',
      items: [
        { name: '20L Premium Water', quantity: 3 },
        { name: '5L Family Pack', quantity: 2 }
      ],
      specialInstructions: 'Customer prefers morning delivery',
      estimatedDuration: '35 minutes',
      routeOptimization: 'Optimized for traffic'
    });
    results.push({ type: 'Driver Assignment', success: driverResult.success });
    console.log('   ✅ Driver Assignment:', driverResult.success ? 'SUCCESS' : 'FAILED');

    // Test 3: Sales Lead Notification
    console.log('\n3️⃣ Testing Sales Lead Notification...');
    const salesResult = await notificationService.sendSalesLeadNotification({
      salespersonEmail: 'sales@abaisprings.com',
      salespersonName: 'James Kiprop',
      leadName: 'Corporate Solutions Ltd',
      leadEmail: 'orders@corporate.co.ke',
      leadPhone: '+254 700 555 777',
      leadSource: 'Referral',
      leadScore: 92,
      interestLevel: 85,
      estimatedValue: 300000,
      territory: 'Nairobi West',
      followUpDate: 'Today at 2:00 PM',
      notes: 'Large corporate client interested in bulk water supply'
    });
    results.push({ type: 'Sales Lead', success: salesResult.success });
    console.log('   ✅ Sales Lead:', salesResult.success ? 'SUCCESS' : 'FAILED');

    // Test 4: Warehouse Inventory Alert
    console.log('\n4️⃣ Testing Warehouse Inventory Alert...');
    const warehouseResult = await notificationService.sendWarehouseInventoryAlert({
      warehouseEmail: 'warehouse@abaisprings.com',
      warehouseStaff: 'Warehouse Team',
      alertType: 'Low Stock Alert',
      priority: 'high',
      actionRequired: 'Schedule restocking within 24 hours',
      estimatedImpact: 'Potential delays affecting 8 customers',
      items: [
        { 
          name: '1L Bottles', 
          currentStock: 25, 
          minimumRequired: 100,
          status: 'Low',
          critical: false,
          estimatedDaysLeft: 2
        }
      ],
      recommendations: 'Contact supplier for immediate restocking',
      supplierInfo: {
        name: 'AquaPure Supplies Ltd',
        contact: '+254 700 999 888',
        leadTime: '2-3 business days',
        minimumOrder: '200 units'
      }
    });
    results.push({ type: 'Warehouse Alert', success: warehouseResult.success });
    console.log('   ✅ Warehouse Alert:', warehouseResult.success ? 'SUCCESS' : 'FAILED');

    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    const successCount = results.filter(r => r.success).length;
    const totalTests = results.length;
    
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${result.type}`);
    });
    
    console.log(`\n🎯 Overall Result: ${successCount}/${totalTests} tests passed`);
    
    if (successCount === totalTests) {
      console.log('🎉 All email notifications working perfectly!');
      console.log('\n📧 Check these email addresses for the test emails:');
      console.log('   • owner@abaisprings.com - Daily Business Insights');
      console.log('   • driver@abaisprings.com - Delivery Assignment');
      console.log('   • sales@abaisprings.com - Sales Lead Notification');
      console.log('   • warehouse@abaisprings.com - Inventory Alert');
    } else {
      console.log('⚠️  Some tests failed. Check the error messages above.');
    }

  } catch (error) {
    console.error('❌ Test suite error:', error.message);
  }
}

// Run all tests
testAllEmailTypes();




































