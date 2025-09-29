const express = require('express');
const path = require('path');

console.log('🚀 Starting port test server...');

const app = express();
const PORT = 8080; // Different port

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Admin dashboard route
app.get('/admin-fixed', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard-fixed.html'));
});

// Simple API endpoints
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Port test server is running on port 8080',
    timestamp: new Date().toISOString()
  });
});

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

// Try different binding methods
const server = app.listen(PORT, () => {
  console.log(`🚀 Port test server running on http://localhost:${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}/api`);
  console.log(`🔧 Admin Dashboard available at http://localhost:${PORT}/admin-fixed`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.log('Port is in use, trying port 5000...');
    // Try port 5000
    const server2 = app.listen(5000, () => {
      console.log(`🚀 Server running on http://localhost:5000`);
    });
  }
});











