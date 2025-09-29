import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Role from '../models/Role.js';
import logger from '../utils/logger.js';

// Load environment variables
dotenv.config({ path: '../config.env' });

async function setupAuthentication() {
  try {
    console.log('🚀 Starting Authentication System Setup...\n');

    // Connect to database
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Create default roles
    console.log('👑 Setting up default roles...');
    await Role.createDefaultRoles();
    console.log('✅ Default roles created\n');

    // Step 2: Create super admin user if not exists
    console.log('👤 Setting up super admin user...');
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@abaisprings.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
    
    let superAdmin = await User.findOne({ email: superAdminEmail });
    
    if (!superAdmin) {
      superAdmin = new User({
        name: 'Super Administrator',
        email: superAdminEmail,
        password: superAdminPassword,
        phone: '+254700000000',
        role: 'super_admin',
        isActive: true,
        emailVerified: true,
        addresses: [{
          type: 'office',
          address: 'Abai Springs Head Office, Nairobi, Kenya',
          isDefault: true
        }],
        securitySettings: {
          requireMfaForSensitiveActions: true,
          sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
          blockSuspiciousActivity: true,
          passwordExpiryDays: 90
        },
        privacySettings: {
          allowDataCollection: true,
          allowMarketing: false,
          allowNotifications: true
        }
      });

      await superAdmin.save();
      console.log(`✅ Super admin created: ${superAdminEmail}`);
      console.log(`🔑 Password: ${superAdminPassword}`);
      console.log('⚠️  Please change the password after first login!\n');
    } else {
      console.log('ℹ️  Super admin already exists\n');
    }

    // Step 3: Create demo users for testing
    console.log('👥 Setting up demo users...');
    
    const demoUsers = [
      {
        name: 'John Manager',
        email: 'manager@abaisprings.com',
        password: 'Manager123!',
        phone: '+254701000000',
        role: 'manager'
      },
      {
        name: 'Jane Staff',
        email: 'staff@abaisprings.com',
        password: 'Staff123!',
        phone: '+254702000000',
        role: 'staff'
      },
      {
        name: 'Bob Customer',
        email: 'customer@abaisprings.com',
        password: 'Customer123!',
        phone: '+254703000000',
        role: 'customer'
      }
    ];

    for (const userData of demoUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const user = new User({
          ...userData,
          isActive: true,
          emailVerified: true,
          addresses: [{
            type: 'home',
            address: `${userData.name} Address, Nairobi, Kenya`,
            isDefault: true
          }]
        });
        await user.save();
        console.log(`✅ Demo user created: ${userData.email} (${userData.role})`);
      }
    }
    console.log();

    // Step 4: Display setup summary
    console.log('📊 Setup Summary:');
    console.log('================');
    
    const roleCount = await Role.countDocuments();
    const userCount = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: { $in: ['admin', 'super_admin'] } });
    
    console.log(`📝 Roles created: ${roleCount}`);
    console.log(`👤 Users created: ${userCount}`);
    console.log(`👑 Admin users: ${adminCount}`);
    console.log();

    // Step 5: Display available endpoints
    console.log('🌐 Available Authentication Endpoints:');
    console.log('====================================');
    console.log('Basic Auth:');
    console.log('  POST /api/auth/register - User registration');
    console.log('  POST /api/auth/login - User login');
    console.log('  POST /api/auth/logout - User logout');
    console.log('  GET  /api/auth/profile - Get user profile');
    console.log();
    
    console.log('Advanced Auth:');
    console.log('  POST /api/auth/advanced/mfa/setup/totp - Setup TOTP MFA');
    console.log('  POST /api/auth/advanced/mfa/setup/sms - Setup SMS MFA');
    console.log('  POST /api/auth/advanced/social/google - Google login');
    console.log('  POST /api/auth/advanced/social/facebook - Facebook login');
    console.log('  GET  /api/auth/advanced/sessions - Get active sessions');
    console.log('  POST /api/auth/advanced/api-keys - Generate API key');
    console.log();
    
    console.log('Token Management:');
    console.log('  POST /api/auth/token/refresh - Refresh access token');
    console.log('  POST /api/auth/token/logout - Logout with token cleanup');
    console.log('  GET  /api/auth/token/active - Get active tokens');
    console.log('  GET  /api/auth/token/stats - Token statistics (admin)');
    console.log();

    // Step 6: Environment variables check
    console.log('🔧 Environment Configuration:');
    console.log('=============================');
    
    const requiredEnvVars = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'MONGODB_URI'
    ];
    
    const optionalEnvVars = [
      'GOOGLE_CLIENT_ID',
      'FACEBOOK_APP_ID',
      'TWILIO_ACCOUNT_SID',
      'SMTP_HOST',
      'REDIS_HOST'
    ];

    console.log('Required variables:');
    requiredEnvVars.forEach(envVar => {
      const exists = !!process.env[envVar];
      console.log(`  ${exists ? '✅' : '❌'} ${envVar}: ${exists ? 'Set' : 'Missing'}`);
    });

    console.log('\nOptional variables (for enhanced features):');
    optionalEnvVars.forEach(envVar => {
      const exists = !!process.env[envVar];
      console.log(`  ${exists ? '✅' : '⚠️ '} ${envVar}: ${exists ? 'Set' : 'Not set'}`);
    });
    console.log();

    // Step 7: Security recommendations
    console.log('🔒 Security Recommendations:');
    console.log('============================');
    console.log('1. Change the super admin password after first login');
    console.log('2. Set up proper environment variables for production');
    console.log('3. Enable MFA for all admin accounts');
    console.log('4. Configure SMTP for email notifications');
    console.log('5. Set up Redis for session management');
    console.log('6. Configure social login providers if needed');
    console.log('7. Set up proper logging and monitoring');
    console.log();

    console.log('✅ Authentication system setup completed successfully!');
    console.log('🚀 Your Abai Springs application is ready with enterprise-grade authentication!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    logger.error('Authentication setup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupAuthentication();
}

export default setupAuthentication;









