import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = join(__dirname, '..', 'config.env');
dotenv.config({ path: configPath });

async function resetAdminPassword() {
  try {
    console.log('🔐 Admin Password Reset Script\n');
    console.log('📦 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'admin@abaisprings.com';
    const newPassword = 'admin123'; // Set to a simple password you can remember
    
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    
    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      process.exit(1);
    }

    console.log(`👤 Found user: ${user.name} (${user.email})`);
    console.log(`🔑 Resetting password to: ${newPassword}\n`);

    // Set the new password (the User model will hash it automatically)
    user.password = newPassword;
    await user.save();

    // Also unlock the account and reset login attempts
    await user.resetLoginAttempts();

    console.log('✅ Password reset successfully!');
    console.log('✅ Account unlocked!');
    console.log('\n📋 Login Details:');
    console.log('==================');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('\n🎉 You can now login with these credentials!');

  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
    process.exit(0);
  }
}

resetAdminPassword();












