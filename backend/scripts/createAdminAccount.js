import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables - try production config first, then fallback to dev
const prodConfigPath = join(__dirname, '..', 'config.prod.env');
const devConfigPath = join(__dirname, '..', 'config.env');
const connectionStringPath = join(__dirname, '..', '..', 'YOUR_CONNECTION_STRING.txt');

// Try to load production config, fallback to dev if not found
if (fs.existsSync(prodConfigPath)) {
  dotenv.config({ path: prodConfigPath });
  console.log('📋 Using production config');
} else {
  dotenv.config({ path: devConfigPath });
  console.log('📋 Using development config');
}

// Override MONGODB_URI if connection string file exists with correct credentials
if (fs.existsSync(connectionStringPath)) {
  const connectionStringContent = fs.readFileSync(connectionStringPath, 'utf8');
  const connectionStringMatch = connectionStringContent.match(/mongodb\+srv:\/\/[^\s]+/);
  if (connectionStringMatch) {
    process.env.MONGODB_URI = connectionStringMatch[0];
    console.log('📋 Using connection string from YOUR_CONNECTION_STRING.txt');
  }
}

async function createAdminAccount() {
  try {
    console.log('🔧 Creating/Updating Admin Account...\n');
    console.log('📦 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = process.env.ADMIN_EMAIL || 'admin@abaisprings.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin123!';
    const name = process.env.ADMIN_NAME || 'System Administrator';
    const phone = process.env.ADMIN_PHONE || '+254700000000';

    // Check if admin user already exists
    let adminUser = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (adminUser) {
      console.log(`👤 Found existing user: ${adminUser.name} (${adminUser.email})`);
      console.log(`📊 Current role: ${adminUser.role}`);
      
      // Update to admin if not already
      if (adminUser.role !== 'admin' && adminUser.role !== 'super_admin') {
        console.log(`\n🔄 Updating role to 'admin'...`);
        adminUser.role = 'admin';
      }
      
      // Update password if provided
      if (password) {
        console.log(`🔑 Updating password...`);
        adminUser.password = password;
      }
      
      // Ensure account is active
      adminUser.isActive = true;
      adminUser.emailVerified = true;
      
      await adminUser.save();
      console.log('✅ Admin account updated successfully!');
    } else {
      // Create new admin user
      console.log(`\n➕ Creating new admin account...`);
      adminUser = await User.create({
        name: name,
        email: email.toLowerCase().trim(),
        password: password,
        phone: phone,
        role: 'admin',
        isActive: true,
        emailVerified: true,
        addresses: [{
          type: 'office',
          address: 'Abai Springs Head Office, Nairobi, Kenya',
          isDefault: true
        }]
      });
      console.log('✅ Admin account created successfully!');
    }

    // Verify the account
    const verifiedUser = await User.findOne({ email: email.toLowerCase().trim() });
    
    console.log(`\n📊 Admin Account Details:`);
    console.log(`   Name: ${verifiedUser.name}`);
    console.log(`   Email: ${verifiedUser.email}`);
    console.log(`   Role: ${verifiedUser.role}`);
    console.log(`   Phone: ${verifiedUser.phone}`);
    console.log(`   Is Active: ${verifiedUser.isActive}`);
    console.log(`   Email Verified: ${verifiedUser.emailVerified}`);
    console.log(`\n🎉 Admin account is ready!`);
    console.log(`\n📋 Login Credentials:`);
    console.log(`   URL: https://abai-springs-webapp-production.up.railway.app/admin`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`\n⚠️  Please change the password after first login!`);

  } catch (error) {
    console.error('❌ Error creating/updating admin account:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
    process.exit(0);
  }
}

createAdminAccount();

