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

async function checkAdminAccount() {
  try {
    console.log('🔍 Checking Admin Account in Database...\n');
    console.log('📦 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'admin@abaisprings.com';
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    
    if (!user) {
      console.log(`❌ Admin account NOT FOUND in database`);
      console.log(`   Email: ${email}`);
      console.log(`\n💡 To create the admin account, run:`);
      console.log(`   cd backend`);
      console.log(`   npm run create-admin`);
      process.exit(1);
    }

    console.log('✅ Admin account EXISTS in database\n');
    console.log('📊 Account Details:');
    console.log('='.repeat(60));
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone || 'Not set'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Is Active: ${user.isActive}`);
    console.log(`   Email Verified: ${user.emailVerified || false}`);
    console.log(`   Created At: ${user.createdAt || 'Unknown'}`);
    console.log(`   Updated At: ${user.updatedAt || 'Unknown'}`);
    
    // Check if account is locked
    if (user.loginAttempts !== undefined && user.lockUntil !== undefined) {
      const isLocked = user.isLocked && user.isLocked();
      console.log(`   Login Attempts: ${user.loginAttempts || 0}`);
      console.log(`   Account Locked: ${isLocked ? 'Yes' : 'No'}`);
      if (isLocked && user.lockUntil) {
        console.log(`   Locked Until: ${user.lockUntil}`);
      }
    }
    
    console.log('='.repeat(60));
    
    // Test password
    console.log('\n🔑 Testing Password...');
    const expectedPassword = 'Admin123!';
    const isPasswordMatch = await user.comparePassword(expectedPassword);
    
    if (isPasswordMatch) {
      console.log(`✅ Password "${expectedPassword}" is CORRECT`);
    } else {
      console.log(`❌ Password "${expectedPassword}" is INCORRECT`);
      console.log(`\n💡 To reset the password, run:`);
      console.log(`   cd backend`);
      console.log(`   npm run create-admin`);
    }
    
    // Check role
    console.log('\n👤 Role Check:');
    if (user.role === 'admin' || user.role === 'super_admin') {
      console.log(`✅ Role is correct: "${user.role}"`);
    } else {
      console.log(`❌ Role is "${user.role}" but needs to be "admin"`);
      console.log(`\n💡 To update the role, run:`);
      console.log(`   cd backend`);
      console.log(`   npm run update-admin-role`);
    }
    
    // Overall status
    console.log('\n' + '='.repeat(60));
    console.log('📋 Login Status:');
    console.log('='.repeat(60));
    
    const canLogin = user.isActive && 
                     (user.role === 'admin' || user.role === 'super_admin') && 
                     isPasswordMatch &&
                     (!user.isLocked || !user.isLocked());
    
    if (canLogin) {
      console.log('✅ Account is ready for login!');
      console.log(`\n📋 Login Credentials:`);
      console.log(`   URL: https://abai-springs-webapp-production.up.railway.app/admin`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${expectedPassword}`);
    } else {
      console.log('❌ Account has issues preventing login:');
      if (!user.isActive) console.log('   - Account is not active');
      if (user.role !== 'admin' && user.role !== 'super_admin') console.log('   - Role is not admin');
      if (!isPasswordMatch) console.log('   - Password does not match expected value');
      if (user.isLocked && user.isLocked()) console.log('   - Account is locked');
    }
    
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error checking admin account:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkAdminAccount();

