import http from 'http';
import { URL } from 'url';

const healthCheckUrl = new URL(`http://localhost:${process.env.PORT || 3001}/health`);

const options = {
  hostname: healthCheckUrl.hostname,
  port: healthCheckUrl.port,
  path: healthCheckUrl.pathname,
  method: 'GET',
  timeout: 3000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0); // Healthy
  } else {
    console.error(`Health check failed with status: ${res.statusCode}`);
    process.exit(1); // Unhealthy
  }
});

req.on('timeout', () => {
  console.error('Health check timeout');
  req.destroy();
  process.exit(1);
});

req.on('error', (err) => {
  console.error('Health check error:', err.message);
  process.exit(1);
});

req.end();






