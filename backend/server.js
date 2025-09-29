import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes (testing systematically to identify problematic routes)
import authRoutes from './routes/auth.js';
import authAdvancedRoutes from './routes/authAdvanced.js';
// import authTokenRoutes from './routes/authToken.js';
import productRoutes from './routes/products-simple.js';
import outletRoutes from './routes/outlets-simple.js';
import orderRoutes from './routes/orders.js';
import cartRoutes from './routes/cart.js';
import analyticsRoutes from './routes/analytics.js';
import paymentRoutes from './routes/payments.js';
// import enhancedPaymentRoutes from './routes/payments.enhanced.js';
// import enhancedOrderRoutes from './routes/orders.enhanced.js';
// import enhancedAnalyticsRoutes from './routes/analytics.enhanced.js';
import logRoutes from './routes/logs.js';
import cacheRoutes from './routes/cache.js';
import dashboardRoutes from './routes/dashboards.js';
import inventoryRoutes from './routes/inventory.js';
import newsletterRoutes from './routes/newsletter.js';
import aiRoutes from './routes/ai.js';
import stockAlertRoutes from './routes/stockAlerts.js';
import alertRoutes from './routes/alerts.js';
import staffAuthRoutes from './routes/staffAuth.js';

// Import new dashboard routes
import staffRoutes from './routes/staff.js';
import salesRoutes from './routes/sales.js';
import driverRoutes from './routes/drivers.js';
import stockMovementRoutes from './routes/stock-movements.js';
// import aiStockMonitor from './services/aiStockMonitor.js';
import smartStockAlertService from './services/smartStockAlertService.js';

// Import models (re-enabling all models)
import User from './models/User.js';
import Product from './models/Product.js';
import Order from './models/Order.js';
import Outlet from './models/Outlet.js';
import Payment from './models/Payment.js';
import Role from './models/Role.js';
import Wallet from './models/Wallet.js';
import EnhancedOrder from './models/Order.enhanced.js';
import Subscription from './models/Subscription.js';

// Import services for initialization
// import realTimeTrackingService from './services/tracking/realTimeTrackingService.js';
// import subscriptionService from './services/subscriptionService.js';
// import realTimeAnalyticsEngine from './services/analytics/realTimeAnalyticsEngine.js';

// Import middleware (re-enabling all middleware)
import errorHandler from './middleware/errorHandler.js';
import validate from './middleware/validate.js';
import { securityHeaders } from './middleware/auth.js';
import { requestLogger, errorLogger } from './middleware/logging.js';

// Import logger
// import logger from './utils/logger.js';

// Import cache manager
// import cacheManager from './utils/cache.js';

// Import rate limiting
// import { globalRateLimit, apiRateLimit, adminRateLimit, getRateLimitStats } from './middleware/rateLimiting.js';

const app = express();

// Configure view engine for dashboard templates
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use(securityHeaders);

// Global rate limiting (apply to all requests)
// app.use(globalRateLimit);

// Add validation middleware
// app.use(validate);

// Logging middleware
// app.use(requestLogger);

// Staff Portal Routes (must come BEFORE static file serving)
app.get('/staff-login', (req, res) => {
  res.sendFile(path.join(__dirname, '../staff-login.html'));
});

app.get('/owner-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../owner-dashboard.html'));
});

// Admin Dashboard Routes (must come BEFORE static file serving)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/admin-simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard-simple.html'));
});

app.get('/admin-fixed', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard-fixed.html'));
});

// Database connection with timeout
console.log('🔄 Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000, // 10 seconds timeout
  connectTimeoutMS: 10000,
  socketTimeoutMS: 10000
})
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    // Start smart stock alert monitoring after database connection
    try {
      smartStockAlertService.startMonitoring();
    } catch (error) {
      console.error('❌ Error starting smart stock alert service:', error);
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    console.log('⚠️  Server will continue without database for testing...');
  });

// API Routes with rate limiting (testing core routes first)
console.log('🔧 Registering API routes...');
app.use('/api/auth', authRoutes);
console.log('✅ Auth route registered');
app.use('/api/auth/advanced', authAdvancedRoutes);
console.log('✅ Auth advanced route registered');
app.use('/api/auth/staff', staffAuthRoutes);
console.log('✅ Staff auth route registered');
// app.use('/api/auth/token', authTokenRoutes);
app.use('/api/products', productRoutes);
console.log('✅ Products route registered');
app.use('/api/outlets', outletRoutes);
console.log('✅ Outlets route registered');
app.use('/api/orders', orderRoutes);
console.log('✅ Orders route registered');
// app.use('/api/orders/enhanced', enhancedOrderRoutes); // Enhanced order management
app.use('/api/cart', cartRoutes);
console.log('✅ Cart route registered');
app.use('/api/analytics', analyticsRoutes);
console.log('✅ Analytics route registered');
// app.use('/api/analytics/enhanced', enhancedAnalyticsRoutes); // Advanced analytics & BI
app.use('/api/dashboards', dashboardRoutes); // Dashboard routes with authentication
console.log('✅ Dashboards route registered');
app.use('/api/inventory', inventoryRoutes); // Outlet inventory management
console.log('✅ Inventory route registered');
// app.use('/api/newsletter', newsletterRoutes); // Newsletter subscriptions - CAUSING HANG
// app.use('/api/ai', aiRoutes); // AI features (chatbot, smart alerts) - CAUSING HANG
app.use('/api/stock-alerts', stockAlertRoutes); // Smart stock alerts
console.log('✅ Stock alerts route registered');
app.use('/api/alerts', alertRoutes); // Alert management
console.log('✅ Alerts route registered');

// Dashboard Management Routes
app.use('/api/staff', staffRoutes); // Staff Management
console.log('✅ Staff route registered');
app.use('/api/sales', salesRoutes); // Sales Management
console.log('✅ Sales route registered');
app.use('/api/drivers', driverRoutes); // Driver Management
console.log('✅ Drivers route registered');
app.use('/api/stock-movements', stockMovementRoutes); // Stock Movement Management
console.log('✅ Stock movements route registered');

// Test route for stock alerts
app.get('/api/test-stock-alerts', (req, res) => {
  res.json({
    success: true,
    message: 'Stock alerts test route working',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/payments', paymentRoutes); // Already has specific rate limiting
console.log('✅ Payments route registered');
// app.use('/api/payments/enhanced', enhancedPaymentRoutes); // Enhanced payment features
app.use('/api/logs', logRoutes);
console.log('✅ Logs route registered');
app.use('/api/cache', cacheRoutes);
console.log('✅ Cache route registered');

// Base API endpoint - MUST be before static file serving
app.get('/api', (req, res) => {
  console.log('🔍 API base endpoint hit');
  res.json({
    success: true,
    message: 'Abai Springs API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      products: '/api/products',
      outlets: '/api/outlets',
      orders: '/api/orders',
      cart: '/api/cart',
      auth: '/api/auth',
      'staff-auth': '/api/auth/staff',
      analytics: '/api/analytics',
      logs: '/api/logs',
      cache: '/api/cache',
      health: '/api/health',
      test: '/api/test-db',
      // Dashboard Management
      staff: '/api/staff',
      sales: '/api/sales',
      drivers: '/api/drivers',
      'stock-movements': '/api/stock-movements'
    },
    status: 'API is running correctly'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Abai Springs API is running',
    timestamp: new Date().toISOString()
  });
});

// Rate limiting statistics endpoint
// app.get('/api/rate-limit-stats', getRateLimitStats);

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const statusText = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    res.json({
      status: 'Database Test',
      connectionState: statusText[dbStatus],
      readyState: dbStatus,
      message: dbStatus === 1 ? 'Database connected successfully' : 'Database not connected'
    });
  } catch (error) {
    res.json({
      status: 'Database Test Error',
      error: error.message
    });
  }
});

// Error logging middleware
// app.use(errorLogger);

// Error handling middleware (must be last)
app.use(errorHandler);

// Serve static files manually (CSS, JS, images) - exclude API routes
app.get(['/style.css', '/script.js', '/chatbot.js', '/images/*'], (req, res, next) => {
  // Skip if this is an API route (including /api without trailing slash)
  if (req.path.startsWith('/api') || req.path.startsWith('/api/')) {
    console.log(`🚫 Skipping static file serving for API route: ${req.path}`);
    return next();
  }
  
  const filePath = path.join(__dirname, '..', req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.log(`Static file not found: ${req.path}`);
      return next();
    }
  });
});

// Staff Portal Routes
app.get('/staff-login', (req, res) => {
  console.log(`🔐 Serving staff login page`);
  res.sendFile(path.join(__dirname, '../staff-login.html'));
});

app.get('/owner-dashboard', (req, res) => {
  console.log(`👑 Serving owner dashboard`);
  res.sendFile(path.join(__dirname, '../owner-dashboard.html'));
});

app.get('/owner-dashboard.html', (req, res) => {
  console.log(`👑 Serving owner dashboard (with .html)`);
  res.sendFile(path.join(__dirname, '../owner-dashboard.html'));
});

app.get('/sales-dashboard', (req, res) => {
  console.log(`📊 Serving sales dashboard`);
  res.sendFile(path.join(__dirname, '../sales-dashboard.html'));
});

app.get('/sales-dashboard.html', (req, res) => {
  console.log(`📊 Serving sales dashboard (with .html)`);
  res.sendFile(path.join(__dirname, '../sales-dashboard.html'));
});

app.get('/driver-dashboard', (req, res) => {
  console.log(`🚚 Serving driver dashboard`);
  res.sendFile(path.join(__dirname, '../driver-dashboard.html'));
});

app.get('/driver-dashboard.html', (req, res) => {
  console.log(`🚚 Serving driver dashboard (with .html)`);
  res.sendFile(path.join(__dirname, '../driver-dashboard.html'));
});

app.get('/warehouse-dashboard', (req, res) => {
  console.log(`🏭 Serving warehouse dashboard`);
  res.sendFile(path.join(__dirname, '../warehouse-dashboard.html'));
});

app.get('/warehouse-dashboard.html', (req, res) => {
  console.log(`🏭 Serving warehouse dashboard (with .html)`);
  res.sendFile(path.join(__dirname, '../warehouse-dashboard.html'));
});

// Checkout page route
app.get('/checkout.html', (req, res) => {
  console.log(`🛒 Serving checkout page - Path: ${req.path}`);
  res.sendFile(path.join(__dirname, '../checkout.html'));
});

// Test route to verify server is working
app.get('/test-checkout', (req, res) => {
  console.log(`🧪 Test checkout route hit`);
  res.send('<h1>Checkout Test Page</h1><p>If you see this, the server routes are working!</p>');
});

// Test API route
app.post('/api/test-orders', (req, res) => {
  console.log('🧪 Test orders API route hit');
  res.json({
    success: true,
    message: 'Test orders API is working',
    body: req.body
  });
});

// Order confirmation page route
app.get('/order-confirmation.html', (req, res) => {
  console.log(`✅ Serving order confirmation page`);
  res.sendFile(path.join(__dirname, '../order-confirmation.html'));
});

// Track order page route
app.get('/track-order.html', (req, res) => {
  console.log(`📦 Serving track order page`);
  res.sendFile(path.join(__dirname, '../track-order.html'));
});

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`🔍 Request: ${req.method} ${req.path}`);
  if (req.path === '/api/orders' && req.method === 'POST') {
    console.log('📦 POST /api/orders request detected - should go to orders route');
  }
  next();
});

// Serve frontend for all other routes (must be last)
app.get('*', (req, res) => {
  // Don't serve frontend for API routes (including /api without trailing slash)
  if (req.path.startsWith('/api') || req.path.startsWith('/api/')) {
    console.log(`❌ API route not found: ${req.path}`);
    return res.status(404).json({
      success: false,
      message: 'API endpoint not found',
      path: req.path
    });
  }
  console.log(`📄 CATCH-ALL: Serving frontend for: ${req.path}`);
  res.sendFile(path.join(__dirname, '../index.html'));
});

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, async () => {
  console.log('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });  
  // Initialize real-time tracking with Socket.IO
  // realTimeTrackingService.initialize(server);
  
  // Start real-time analytics engine
  // realTimeAnalyticsEngine starts automatically on import
  
  // Initialize AI Stock Monitor
  // aiStockMonitor.scheduleMonitoring();
  
  console.log(`🚀 Abai Springs server running on port ${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend available at http://localhost:${PORT}`);
  console.log(`🔧 Admin Dashboard available at http://localhost:${PORT}/admin`);
  console.log(`📊 Logs available at http://localhost:${PORT}/api/logs`);
  console.log(`📍 Real-time tracking enabled with Socket.IO`);
  console.log(`📊 Advanced analytics available at http://localhost:${PORT}/api/analytics/enhanced`);
  console.log(`💾 Cache management available at http://localhost:${PORT}/api/cache`);
}); 