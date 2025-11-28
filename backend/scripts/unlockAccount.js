import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Load environment variables
// Try multiple possible paths
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try config.env in the backend directory (parent of scripts)
const configPath = join(__dirname, '..', 'config.env');
dotenv.config({ path: configPath });

async function unlockAccount(email) {
  try {
    console.log('🔓 Account Unlock Script\n');
    console.log('📦 Connecting to MongoDB...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      process.exit(1);
    }

    console.log(`👤 Found user: ${user.name} (${user.email})`);
    console.log(`📊 Current status:`);
    console.log(`   - Login attempts: ${user.loginAttempts || 0}`);
    console.log(`   - Lock until: ${user.lockUntil ? new Date(user.lockUntil).toLocaleString() : 'Not locked'}`);
    console.log(`   - Is locked: ${user.isLocked() ? 'Yes' : 'No'}\n`);

    if (!user.isLocked()) {
      console.log('ℹ️  Account is not currently locked.');
      console.log('   Clearing login attempts anyway...\n');
    }

    // Reset login attempts using the model method
    await user.resetLoginAttempts();
    
    // Verify the unlock by refetching the user
    const updatedUser = await User.findById(user._id);
    
    console.log('✅ Account unlocked successfully!\n');
    console.log(`📊 Updated status:`);
    console.log(`   - Login attempts: ${updatedUser.loginAttempts || 0}`);
    console.log(`   - Lock until: ${updatedUser.lockUntil ? new Date(updatedUser.lockUntil).toLocaleString() : 'Not locked'}`);
    console.log(`   - Is locked: ${updatedUser.isLocked() ? 'Yes' : 'No'}\n`);
    
    console.log('🎉 You can now attempt to login again!');
    console.log(`💡 Try password: SuperAdmin123! (or admin123 if that was set)`);

  } catch (error) {
    console.error('❌ Error unlocking account:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL || 'admin@abaisprings.com';

// Run the unlock function
unlockAccount(email);

