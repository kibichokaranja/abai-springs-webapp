import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

console.log('🌐 Email Notification API Test');
console.log('===============================\n');

async function testEmailAPI() {
  const baseUrl = 'http://localhost:3001/api/staff-notifications';
  
  try {
    // Test 1: Check API status
    console.log('1️⃣ Testing API Status...');
    const statusResponse = await fetch(`${baseUrl}/status`);
    const statusData = await statusResponse.json();
    console.log('   ✅ API Status:', statusData.success ? 'ONLINE' : 'OFFLINE');
    console.log('   📋 Features:', statusData.data?.features?.join(', '));

    // Test 2: Send Owner Daily Insights
    console.log('\n2️⃣ Testing Owner Daily Insights API...');
    const ownerResponse = await fetch(`${baseUrl}/owner/daily-insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-test-token' // You'll need a valid token
      }
    });
    
    if (ownerResponse.ok) {
      const ownerData = await ownerResponse.json();
      console.log('   ✅ Owner Insights API:', ownerData.success ? 'SUCCESS' : 'FAILED');
    } else {
      console.log('   ⚠️  Owner Insights API: Requires authentication');
    }

    // Test 3: Send Driver Assignment
    console.log('\n3️⃣ Testing Driver Assignment API...');
    const driverResponse = await fetch(`${baseUrl}/driver/delivery-assignment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-test-token'
      },
      body: JSON.stringify({
        driverId: '507f1f77bcf86cd799439011',
        orderData: {
          orderNumber: 'AS-2024-001236',
          customerName: 'Test Customer',
          deliveryAddress: 'Test Address',
          items: [{ name: '20L Water', quantity: 2 }]
        }
      })
    });
    
    if (driverResponse.ok) {
      const driverData = await driverResponse.json();
      console.log('   ✅ Driver Assignment API:', driverData.success ? 'SUCCESS' : 'FAILED');
    } else {
      console.log('   ⚠️  Driver Assignment API: Requires authentication');
    }

    console.log('\n📋 API Test Summary:');
    console.log('   • API Status: Checked');
    console.log('   • Owner Insights: Requires auth token');
    console.log('   • Driver Assignment: Requires auth token');
    console.log('\n💡 To test with authentication:');
    console.log('   1. Start your server: npm start');
    console.log('   2. Login to get a valid token');
    console.log('   3. Use the token in Authorization header');

  } catch (error) {
    console.error('❌ API Test Error:', error.message);
    console.log('\n💡 Make sure your server is running on localhost:3001');
  }
}

// Run API tests
testEmailAPI();




































