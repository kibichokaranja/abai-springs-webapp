const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

console.log('🚀 Starting native HTTP server...');

const PORT = 3001;

// Mock data
const mockData = {
  products: [
    { _id: '1', name: 'Abai Water 500ml', brand: 'Abai', price: 50, stock: 150 },
    { _id: '2', name: 'Abai Water 1L', brand: 'Abai', price: 80, stock: 200 },
    { _id: '3', name: 'Sprinkle Water 500ml', brand: 'Sprinkle', price: 45, stock: 120 }
  ],
  outlets: [
    { _id: '1', name: 'Nairobi Central', location: 'Nairobi CBD', phone: '+254 700 123 456', status: 'Active' },
    { _id: '2', name: 'Mombasa Branch', location: 'Mombasa City', phone: '+254 700 789 012', status: 'Active' }
  ],
  orders: [
    { _id: '1', orderNumber: 'ORD001', customer: 'John Doe', total: 100, status: 'Delivered' },
    { _id: '2', orderNumber: 'ORD002', customer: 'Jane Smith', total: 45, status: 'Processing' }
  ],
  users: [
    { _id: '1', name: 'John Doe', email: 'john@example.com', phone: '+254 700 123 456' },
    { _id: '2', name: 'Jane Smith', email: 'jane@example.com', phone: '+254 700 789 012' }
  ]
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`${req.method} ${pathname}`);

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoints
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'OK',
      message: 'Native HTTP server is running',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (pathname === '/api/products') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.products));
    return;
  }

  if (pathname === '/api/outlets') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.outlets));
    return;
  }

  if (pathname === '/api/orders') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.orders));
    return;
  }

  if (pathname === '/api/auth/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.users));
    return;
  }

  if (pathname === '/api/stock-alerts/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeAlerts: 5,
      alertsSentToday: 12,
      monitoringActive: true,
      totalPredictions: 8
    }));
    return;
  }

  if (pathname === '/api/stock-alerts') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // Handle POST requests
  if (req.method === 'POST') {
    if (pathname === '/api/stock-alerts/monitoring/start') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Monitoring started' }));
      return;
    }

    if (pathname === '/api/stock-alerts/monitoring/stop') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Monitoring stopped' }));
      return;
    }
  }

  // Serve admin dashboard
  if (pathname === '/admin-fixed') {
    const filePath = path.join(__dirname, 'admin-dashboard-fixed.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Admin Dashboard Not Found</h1>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // Serve static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, '..', filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }

    // Determine content type
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'application/javascript';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.json') contentType = 'application/json';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.jpg') contentType = 'image/jpg';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Native HTTP server running on http://127.0.0.1:${PORT}`);
  console.log(`📱 API available at http://127.0.0.1:${PORT}/api`);
  console.log(`🔧 Admin Dashboard available at http://127.0.0.1:${PORT}/admin-fixed`);
  console.log(`🌐 Frontend available at http://127.0.0.1:${PORT}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
});











