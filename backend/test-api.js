// Simple API test script
import http from 'http';

function testEndpoint(path, description) {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`\n${description}:`);
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('Response:', JSON.stringify(jsonData, null, 2));
      } catch (e) {
        console.log('Raw Response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`\n${description} Error:`, e.message);
  });

  req.end();
}

console.log('Testing API endpoints...\n');

// Test basic endpoints
testEndpoint('/api/health', 'Health Check');
testEndpoint('/api/products', 'Products');
testEndpoint('/api/outlets', 'Outlets');
testEndpoint('/api', 'API Base');
