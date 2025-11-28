import dotenv from 'dotenv';
import notificationService from './services/notificationService.js';

// Load environment variables
dotenv.config({ path: './config.env' });

console.log('🧪 Simple Email Notification Test');
console.log('==================================\n');

async function testSimpleEmail() {
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
        { name: '5L Family Pack', sales: 18 }
      ],
      lowStockItems: [
        { name: '500ml Bottles', quantity: 15, urgency: 'critical' }
      ],
      customerGrowth: 12.5,
      driverPerformance: [
        { name: 'Peter Kamau', deliveries: 15, rating: 4.8 }
      ],
      salesPerformance: [
        { name: 'James Kiprop', achievement: 95 }
      ],
      warehouseEfficiency: 92.5
    };

    const result = await notificationService.sendOwnerDailyInsights(ownerInsights);
    console.log('✅ Owner Daily Insights Result:', result);

    if (result.success) {
      console.log('\n🎉 Email sent successfully!');
      console.log('📧 Check the email inbox for owner@abaisprings.com');
      console.log('📋 Message ID:', result.messageId);
    } else {
      console.log('\n❌ Email failed to send:', result.error);
    }

  } catch (error) {
    console.error('❌ Error testing email notifications:', error.message);
  }
}

// Run the test
testSimpleEmail();




































