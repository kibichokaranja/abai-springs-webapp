// Script to update all HTML files to use config.js
// Run this with: node update-api-urls.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToUpdate = [
  'checkout.html',
  'order-confirmation.html',
  'track-order.html',
  'owner-dashboard.html',
  'manager-dashboard.html',
  'driver-dashboard.html',
  'warehouse-dashboard.html',
  'sales-dashboard.html',
  'dashboard.html',
  'login.html',
  'register.html',
  'staff-portal.html',
  'customer-portal.html',
  'orders.html',
  'payment-confirmation.html'
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // Add config.js script before other scripts if not present
    if (!content.includes('config.js')) {
      // Find </head> or first <script> tag
      if (content.includes('</head>')) {
        content = content.replace('</head>', '    <script src="config.js"></script>\n</head>');
        updated = true;
      } else if (content.includes('<script>')) {
        content = content.replace('<script>', '<script src="config.js"></script>\n    <script>');
        updated = true;
      }
    }

    // Update API_BASE_URL to use window.API_BASE_URL
    const oldPattern = /const API_BASE_URL = ['"]http:\/\/localhost:3001\/api['"];?/g;
    if (oldPattern.test(content)) {
      content = content.replace(
        /const API_BASE_URL = ['"]http:\/\/localhost:3001\/api['"];?/g,
        "const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001/api';"
      );
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  Skipped (already updated or no changes): ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Update all files
console.log('🔄 Updating API URLs in frontend files...\n');
let updatedCount = 0;

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    if (updateFile(filePath)) {
      updatedCount++;
    }
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log(`\n✨ Done! Updated ${updatedCount} files.`);





