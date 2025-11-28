const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('🚀 Starting Working Staff Portal Server...');

const app = express();
const PORT = 3001;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Staff Portal Routes
app.get('/staff-login', (req, res) => {
  console.log('📄 Serving staff-login.html');
  res.sendFile(path.join(__dirname, '../staff-login.html'));
});

app.get('/owner-dashboard', (req, res) => {
  console.log('📄 Serving owner-dashboard.html');
  res.sendFile(path.join(__dirname, '../owner-dashboard.html'));
});

// Mock staff authentication API
app.post('/api/auth/staff-login', (req, res) => {
  console.log('🔐 Staff login attempt:', req.body);
  
  const { email, password, role } = req.body;
  
  // Mock authentication - you can modify these credentials
  if (email === 'admin@abaisprings.com' && password === 'password123' && role === 'owner') {
    res.json({
      success: true,
      message: 'Staff login successful',
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: '1',
        name: 'Business Owner',
        email: 'admin@abaisprings.com',
        role: 'owner'
      }
    });
  } else if (email === 'sales@abaisprings.com' && password === 'sales123' && role === 'sales') {
    res.json({
      success: true,
      message: 'Staff login successful',
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: '2',
        name: 'Sales Manager',
        email: 'sales@abaisprings.com',
        role: 'sales'
      }
    });
  } else if (email === 'driver@abaisprings.com' && password === 'driver123' && role === 'driver') {
    res.json({
      success: true,
      message: 'Staff login successful',
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: '3',
        name: 'Delivery Driver',
        email: 'driver@abaisprings.com',
        role: 'driver'
      }
    });
  } else if (email === 'warehouse@abaisprings.com' && password === 'warehouse123' && role === 'warehouse') {
    res.json({
      success: true,
      message: 'Staff login successful',
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: '4',
        name: 'Warehouse Manager',
        email: 'warehouse@abaisprings.com',
        role: 'warehouse'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials. Please check your email, password, and role selection.'
    });
  }
});

// Mock data endpoints for dashboards
app.get('/api/staff/dashboard-data', (req, res) => {
  res.json({
    success: true,
    data: {
      totalOrders: 156,
      totalRevenue: 45000,
      pendingDeliveries: 23,
      lowStockItems: 5,
      recentOrders: [
        { id: 1, customer: 'John Doe', amount: 2500, status: 'Delivered' },
        { id: 2, customer: 'Jane Smith', amount: 1800, status: 'In Transit' },
        { id: 3, customer: 'Mike Johnson', amount: 3200, status: 'Processing' }
      ]
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Working Staff Portal Server is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      staffLogin: '/staff-login',
      ownerDashboard: '/owner-dashboard',
      apiHealth: '/api/health',
      staffAuth: '/api/auth/staff-login'
    }
  });
});

// Serve main frontend for other routes
app.get('*', (req, res) => {
  console.log('📄 Serving index.html for:', req.path);
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Working Staff Portal Server running on http://localhost:${PORT}`);
  console.log(`📄 Staff Login: http://localhost:${PORT}/staff-login`);
  console.log(`👑 Owner Dashboard: http://localhost:${PORT}/owner-dashboard`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('🔐 Test Credentials:');
  console.log('Owner: admin@abaisprings.com / password123');
  console.log('Sales: sales@abaisprings.com / sales123');
  console.log('Driver: driver@abaisprings.com / driver123');
  console.log('Warehouse: warehouse@abaisprings.com / warehouse123');
});





















































































