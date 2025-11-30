import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = join(__dirname, '..', 'config.env');
dotenv.config({ path: configPath });

async function checkPassword() {
  try {
    console.log('🔍 Checking Admin Password...\n');
    console.log('📦 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'admin@abaisprings.com';
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    
    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      process.exit(1);
    }

    console.log(`👤 Testing passwords for: ${user.name} (${user.email})\n`);
    
    // Test both possible passwords
    const passwords = ['admin123', 'SuperAdmin123!'];
    
    for (const password of passwords) {
      const isMatch = await user.comparePassword(password);
      console.log(`   ${isMatch ? '✅' : '❌'} Password "${password}": ${isMatch ? 'CORRECT!' : 'incorrect'}`);
      if (isMatch) {
        console.log(`\n🎉 Found the correct password: "${password}"`);
        break;
      }
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

checkPassword();












