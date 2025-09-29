import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting working server...');

// Load environment variables
dotenv.config({ path: './config.env' });

// Import routes
import authRoutes from './routes/auth.js';
import authAdvancedRoutes from './routes/authAdvanced.js';
import productRoutes from './routes/products.js';
import outletRoutes from './routes/outlets.js';
import orderRoutes from './routes/orders.js';
import cartRoutes from './routes/cart.js';
import analyticsRoutes from './routes/analytics.js';
import paymentRoutes from './routes/payments.js';
import logRoutes from './routes/logs.js';
import cacheRoutes from './routes/cache.js';
import dashboardRoutes from './routes/dashboards.js';
import inventoryRoutes from './routes/inventory.js';
import newsletterRoutes from './routes/newsletter.js';
import aiRoutes from './routes/ai.js';
import stockAlertRoutes from './routes/stockAlerts.js';

// Import services
import smartStockAlertService from './services/smartStockAlertService.js';
import aiStockMonitor from './services/aiStockMonitor.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../')));

// Professional Admin Dashboard Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/admin-fixed', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard-fixed.html'));
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    console.log('⚠️  Server will continue without database for testing...');
  });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/advanced', authAdvancedRoutes);
app.use('/api/products', productRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/stock-alerts', stockAlertRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/cache', cacheRoutes);

// Test route for stock alerts
app.get('/api/test-stock-alerts', (req, res) => {
  res.json({
    success: true,
    message: 'Stock alerts test route working',
    timestamp: new Date().toISOString()
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

// Serve frontend for all other routes (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

console.log(`📡 Port: ${PORT}`);

app.listen(PORT, () => {
  console.log(`✅ Working server running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Frontend available at http://localhost:${PORT}`);
  console.log(`🔧 Admin Dashboard available at http://localhost:${PORT}/admin`);
  
  // Initialize AI Stock Monitor
  aiStockMonitor.scheduleMonitoring();
  
  // Start Smart Stock Alert monitoring service
  smartStockAlertService.startMonitoring();
});
