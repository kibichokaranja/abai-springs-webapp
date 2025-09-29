import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('🚀 Starting progressive test server...');
console.log(`📡 Port: ${PORT}`);

// Test 1: Basic Express setup
console.log('✅ Test 1: Basic Express setup - PASSED');

// Test 2: Database connection
async function testDatabase() {
  try {
    console.log('🔌 Test 2: Testing database connection...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Test 2: Database connection - PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test 2: Database connection - FAILED:', error.message);
    return false;
  }
}

// Test 3: Import basic models
async function testBasicModels() {
  try {
    console.log('📦 Test 3: Testing basic model imports...');
    const User = (await import('./models/User.js')).default;
    console.log('✅ Test 3: User model import - PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test 3: User model import - FAILED:', error.message);
    return false;
  }
}

// Test 4: Import basic routes
async function testBasicRoutes() {
  try {
    console.log('🛣️ Test 4: Testing basic route imports...');
    const productsRoutes = (await import('./routes/products.js')).default;
    console.log('✅ Test 4: Products routes import - PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test 4: Products routes import - FAILED:', error.message);
    return false;
  }
}

// Test 5: Import middleware
async function testMiddleware() {
  try {
    console.log('🔧 Test 5: Testing middleware imports...');
    const { authenticate } = (await import('./middleware/auth.js'));
    console.log('✅ Test 5: Auth middleware import - PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test 5: Auth middleware import - FAILED:', error.message);
    return false;
  }
}

// Test 6: Import advanced features
async function testAdvancedFeatures() {
  try {
    console.log('🚀 Test 6: Testing advanced feature imports...');
    
    // Test each advanced feature one by one
    console.log('  🔐 Testing auth advanced...');
    const authAdvanced = (await import('./routes/authAdvanced.js')).default;
    
    console.log('  💳 Testing payments enhanced...');
    const paymentsEnhanced = (await import('./routes/payments.enhanced.js')).default;
    
    console.log('  📦 Testing orders enhanced...');
    const ordersEnhanced = (await import('./routes/orders.enhanced.js')).default;
    
    console.log('  📊 Testing analytics enhanced...');
    const analyticsEnhanced = (await import('./routes/analytics.enhanced.js')).default;
    
    console.log('  📈 Testing dashboards...');
    const dashboards = (await import('./routes/dashboards.js')).default;
    
    console.log('✅ Test 6: Advanced features import - PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test 6: Advanced features import - FAILED:', error.message);
    console.error('Error details:', error.stack);
    return false;
  }
}

// Test routes
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Progressive test server is working!',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Run all tests
async function runAllTests() {
  console.log('\n🧪 Running progressive tests...\n');
  
  const results = {
    database: await testDatabase(),
    basicModels: await testBasicModels(),
    basicRoutes: await testBasicRoutes(),
    middleware: await testMiddleware(),
    advancedFeatures: await testAdvancedFeatures()
  };
  
  console.log('\n📊 Test Results:');
  console.log('Database:', results.database ? '✅ PASS' : '❌ FAIL');
  console.log('Basic Models:', results.basicModels ? '✅ PASS' : '❌ FAIL');
  console.log('Basic Routes:', results.basicRoutes ? '✅ PASS' : '❌ FAIL');
  console.log('Middleware:', results.middleware ? '✅ PASS' : '❌ FAIL');
  console.log('Advanced Features:', results.advancedFeatures ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Starting server...');
    app.listen(PORT, () => {
      console.log(`✅ Progressive test server running on http://localhost:${PORT}`);
      console.log(`🔗 Test endpoint: http://localhost:${PORT}/test`);
      console.log(`💚 Health check: http://localhost:${PORT}/health`);
    });
  } else {
    console.log('\n❌ Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});














