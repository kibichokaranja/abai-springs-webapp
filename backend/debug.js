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
  
  app.listen(3005, () => {
    console.log('🚀 Debug server running on port 3005');
    console.log('Test it: http://localhost:3005/test');
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Full error:', error);
}










