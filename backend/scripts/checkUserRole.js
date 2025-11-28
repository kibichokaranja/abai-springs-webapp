import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = join(__dirname, '..', 'config.env');
dotenv.config({ path: configPath });

async function checkUserRole() {
  try {
    console.log('🔍 Checking User Role...\n');
    console.log('📦 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'admin@abaisprings.com';
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      process.exit(1);
    }

    console.log(`👤 User Details:`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Is Active: ${user.isActive}`);
    console.log(`\n⚠️  The admin dashboard requires role to be exactly 'admin'`);
    
    if (user.role !== 'admin') {
      console.log(`\n❌ Current role is "${user.role}" but needs to be "admin"`);
      console.log(`\n🔧 Would you like me to update it to 'admin'?`);
    } else {
      console.log(`\n✅ Role is correct!`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkUserRole();







