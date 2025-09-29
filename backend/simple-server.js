import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting simple server...');

// Load environment variables
dotenv.config({ path: './config.env' });

const app = express();
const PORT = 3002;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });

// Admin dashboard routes
app.get('/admin-fixed', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard-fixed.html'));
});

// Test API endpoints
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Simple server is running',
    timestamp: new Date().toISOString()
  });
});

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

// Simple products endpoint
app.get('/api/products', async (req, res) => {
  try {
    const Product = mongoose.model('Product', new mongoose.Schema({
      name: String,
      brand: String,
      price: Number,
      stock: Number
    }));
    
    const products = await Product.find().limit(10);
    res.json(products);
  } catch (error) {
    res.json([]);
  }
});

// Simple outlets endpoint
app.get('/api/outlets', async (req, res) => {
  try {
    const Outlet = mongoose.model('Outlet', new mongoose.Schema({
      name: String,
      location: String,
      phone: String,
      status: String
    }));
    
    const outlets = await Outlet.find().limit(10);
    res.json(outlets);
  } catch (error) {
    res.json([]);
  }
});

// Simple orders endpoint
app.get('/api/orders', async (req, res) => {
  try {
    const Order = mongoose.model('Order', new mongoose.Schema({
      orderNumber: String,
      customer: String,
      total: Number,
      status: String
    }));
    
    const orders = await Order.find().limit(10);
    res.json(orders);
  } catch (error) {
    res.json([]);
  }
});

// Simple users endpoint
app.get('/api/auth/users', async (req, res) => {
  try {
    const User = mongoose.model('User', new mongoose.Schema({
      name: String,
      email: String,
      phone: String
    }));
    
    const users = await User.find().limit(10);
    res.json(users);
  } catch (error) {
    res.json([]);
  }
});

// Stock alerts endpoints
app.get('/api/stock-alerts/statistics', (req, res) => {
  res.json({
    activeAlerts: 5,
    alertsSentToday: 12,
    monitoringActive: true,
    totalPredictions: 8
  });
});

app.get('/api/stock-alerts', (req, res) => {
  res.json([]);
});

app.post('/api/stock-alerts/monitoring/start', (req, res) => {
  res.json({ success: true, message: 'Monitoring started' });
});

app.post('/api/stock-alerts/monitoring/stop', (req, res) => {
  res.json({ success: true, message: 'Monitoring stopped' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple server running on port ${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}/api`);
  console.log(`🔧 Admin Dashboard available at http://localhost:${PORT}/admin-fixed`);
});
