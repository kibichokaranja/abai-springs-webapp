console.log('Starting debug...');

try {
  console.log('Testing basic imports...');
  const express = require('express');
  console.log('✅ Express imported successfully');
  
  const app = express();
  console.log('✅ Express app created');
  
  app.get('/test', (req, res) => {
    res.json({ message: 'Debug server working!' });
  });
  
  console.log('✅ Route added');
  
  const server = app.listen(8080, '127.0.0.1', () => {
    console.log('🚀 Debug server running on http://127.0.0.1:8080');
    console.log('Test it: http://127.0.0.1:8080/test');
  });
  
  server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Full error:', error);
}
