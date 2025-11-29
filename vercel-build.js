// Build script for Vercel to inject API_BASE_URL into HTML and JS files
// This script runs during Vercel build process

const fs = require('fs');
const path = require('path');

// Get API URL from environment variable (Vercel)
const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

console.log('🔧 Building for Vercel with API_BASE_URL:', API_BASE_URL);

if (!API_BASE_URL || API_BASE_URL.includes('localhost')) {
  console.warn('⚠️ WARNING: API_BASE_URL not set or still using localhost!');
  console.warn('⚠️ Make sure to set API_BASE_URL environment variable in Vercel dashboard');
}

// List of HTML files to update
const htmlFiles = [
  'index.html',
  'checkout.html',
  'order-confirmation.html',
  'track-order.html',
  'staff-login.html',
  'staff-portal.html',
  'owner-dashboard.html',
  'manager-dashboard.html',
  'driver-dashboard.html',
  'warehouse-dashboard.html',
  'sales-dashboard.html',
  'dashboard.html',
  'login.html',
  'register.html',
  'customer-portal.html',
  'orders.html',
  'payment-confirmation.html'
];

// Update each HTML file
htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add or update meta tag for API URL
    const metaTag = `<meta name="api-base-url" content="${API_BASE_URL}">`;
    
    if (content.includes('name="api-base-url"')) {
      // Update existing meta tag
      content = content.replace(
        /<meta name="api-base-url" content="[^"]*">/g,
        metaTag
      );
    } else {
      // Add meta tag in head section
      if (content.includes('</head>')) {
        content = content.replace('</head>', `    ${metaTag}\n</head>`);
      } else if (content.includes('<head>')) {
        content = content.replace('<head>', `<head>\n    ${metaTag}`);
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${file}`);
  }
});

// Update config.js to use the API URL directly
const configJsPath = path.join(__dirname, 'config.js');
if (fs.existsSync(configJsPath)) {
  let configContent = fs.readFileSync(configJsPath, 'utf8');
  
  // Replace the fallback URL in config.js
  configContent = configContent.replace(
    /return 'https:\/\/your-railway-backend\.up\.railway\.app\/api';/g,
    `return '${API_BASE_URL}';`
  );
  
  fs.writeFileSync(configJsPath, configContent, 'utf8');
  console.log('✅ Updated config.js');
}

console.log('✨ Build complete!');




