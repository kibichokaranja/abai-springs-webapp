import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting test server...');

const app = express();
const PORT = 3003;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Admin dashboard routes
app.get('/admin-fixed', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard-fixed.html'));
});

// Test API endpoints
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Test server is running',
    timestamp: new Date().toISOString()
  });
});

// Simple mock endpoints
app.get('/api/products', (req, res) => {
  res.json([
    { _id: '1', name: 'Abai Water 500ml', brand: 'Abai', price: 50, stock: 150 },
    { _id: '2', name: 'Abai Water 1L', brand: 'Abai', price: 80, stock: 200 },
    { _id: '3', name: 'Sprinkle Water 500ml', brand: 'Sprinkle', price: 45, stock: 120 }
  ]);
});

app.get('/api/outlets', (req, res) => {
  res.json([
    { _id: '1', name: 'Nairobi Central', location: 'Nairobi CBD', phone: '+254 700 123 456', status: 'Active' },
    { _id: '2', name: 'Mombasa Branch', location: 'Mombasa City', phone: '+254 700 789 012', status: 'Active' }
  ]);
});

app.get('/api/orders', (req, res) => {
  res.json([
    { _id: '1', orderNumber: 'ORD001', customer: 'John Doe', total: 100, status: 'Delivered' },
    { _id: '2', orderNumber: 'ORD002', customer: 'Jane Smith', total: 45, status: 'Processing' }
  ]);
});

app.get('/api/auth/users', (req, res) => {
  res.json([
    { _id: '1', name: 'John Doe', email: 'john@example.com', phone: '+254 700 123 456' },
    { _id: '2', name: 'Jane Smith', email: 'jane@example.com', phone: '+254 700 789 012' }
  ]);
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
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}/api`);
  console.log(`🔧 Admin Dashboard available at http://localhost:${PORT}/admin-fixed`);
});

