import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = join(__dirname, '..', 'config.env');
dotenv.config({ path: configPath });

async function updateAdminRole() {
  try {
    console.log('🔧 Updating User Role to Admin...\n');
    console.log('📦 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'admin@abaisprings.com';
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      process.exit(1);
    }

    console.log(`👤 Found user: ${user.name} (${user.email})`);
    console.log(`📊 Current role: ${user.role}`);
    console.log(`\n🔄 Updating role to 'admin'...\n`);

    // Update the role
    user.role = 'admin';
    await user.save();

    // Verify the update
    const updatedUser = await User.findOne({ email: email.toLowerCase().trim() });
    
    console.log('✅ Role updated successfully!');
    console.log(`\n📊 Updated Details:`);
    console.log(`   Name: ${updatedUser.name}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Is Active: ${updatedUser.isActive}`);
    console.log(`\n🎉 You can now login to the admin dashboard!`);
    console.log(`\n📋 Login Details:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: admin123`);

  } catch (error) {
    console.error('❌ Error updating role:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
    process.exit(0);
  }
}

updateAdminRole();












