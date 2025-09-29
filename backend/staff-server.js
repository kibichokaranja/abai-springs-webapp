import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Staff Portal Server...');

const app = express();
const PORT = 3003;

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
  
  // Mock authentication
  if (email === 'admin@abaisprings.com' && password === 'password123' && role === 'owner') {
    res.json({
      success: true,
      message: 'Staff login successful',
      token: 'mock-jwt-token',
      user: {
        id: '1',
        name: 'Business Owner',
        email: 'admin@abaisprings.com',
        role: 'owner'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Staff Portal Server is running',
    timestamp: new Date().toISOString()
  });
});

// Serve main frontend for other routes
app.get('*', (req, res) => {
  console.log('📄 Serving index.html for:', req.path);
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Staff Portal Server running on http://localhost:${PORT}`);
  console.log(`📄 Staff Login: http://localhost:${PORT}/staff-login`);
  console.log(`👑 Owner Dashboard: http://localhost:${PORT}/owner-dashboard`);
});
