import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
    index: true // Index for name searches
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^(\+254|0)[1-9]\d{8}$/, 'Please enter a valid Kenyan phone number'],
    index: true // Index for phone number lookups
  },
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'office', 'other'],
      default: 'home'
    },
    address: {
      type: String,
      required: true
    },
    coordinates: {
      lat: Number,
      lng: Number
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  role: {
    type: String,
    enum: ['customer', 'admin', 'staff'],
    default: 'customer'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true // Index for activity tracking
  },
  loginAttempts: {
    type: Number,
    default: 0,
    index: true // Index for security monitoring
  },
  lockUntil: {
    type: Date,
    index: true // Index for account lock queries
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  emailVerified: {
    type: Boolean,
    default: false,
    index: true // Index for email verification status
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  
  // MFA (Multi-Factor Authentication) settings
  mfaEnabled: {
    type: Boolean,
    default: false,
    index: true
  },
  mfaMethods: [{
    type: {
      type: String,
      enum: ['totp', 'sms', 'email'],
      required: true
    },
    secret: String, // For TOTP
    phoneNumber: String, // For SMS
    email: String, // For Email (can be different from main email)
    enabled: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  mfaBackupCodes: [String], // Backup codes for account recovery
  
  // Password policy compliance
  passwordHistory: [{
    hash: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  passwordChangedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  passwordExpireNotification: {
    type: Date,
    index: true
  },
  
  // Session management
  activeSessions: [{
    sessionId: String,
    deviceInfo: {
      userAgent: String,
      ip: String,
      location: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  maxSessions: {
    type: Number,
    default: 5 // Maximum concurrent sessions
  },
  
  // Social login providers
  socialProviders: [{
    provider: {
      type: String,
      enum: ['google', 'facebook', 'apple'],
      required: true
    },
    providerId: {
      type: String,
      required: true
    },
    email: String,
    name: String,
    avatar: String,
    connectedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // API keys for third-party access
  apiKeys: [{
    name: String,
    keyId: String,
    keyHash: String, // Hashed version of the key
    permissions: [String],
    isActive: {
      type: Boolean,
      default: true
    },
    lastUsed: Date,
    expiresAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Active refresh tokens for JWT rotation
  activeRefreshTokens: [{
    jti: String, // JWT ID
    deviceInfo: {
      userAgent: String,
      ip: String,
      location: String,
      deviceType: String,
      browser: String
    },
    issuedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date,
    lastUsed: Date
  }],
  
  // Security settings
  securitySettings: {
    requireMfaForSensitiveActions: {
      type: Boolean,
      default: false
    },
    sessionTimeout: {
      type: Number,
      default: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    },
    allowedIPs: [String], // IP whitelist (empty = allow all)
    blockSuspiciousActivity: {
      type: Boolean,
      default: true
    },
    passwordExpiryDays: {
      type: Number,
      default: 90 // Password expires after 90 days
    }
  },
  
  // Privacy settings
  privacySettings: {
    allowDataCollection: {
      type: Boolean,
      default: true
    },
    allowMarketing: {
      type: Boolean,
      default: true
    },
    allowNotifications: {
      type: Boolean,
      default: true
    },
    dataRetentionDays: {
      type: Number,
      default: 365 // Keep data for 1 year
    }
  },
  
  // User preferences
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'sw'] // English, Swahili
    },
    currency: {
      type: String,
      default: 'KES',
      enum: ['KES', 'USD', 'EUR']
    },
    timezone: {
      type: String,
      default: 'Africa/Nairobi'
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark', 'auto']
    },
    notifications: {
      email: {
        orderUpdates: { type: Boolean, default: true },
        marketing: { type: Boolean, default: true },
        security: { type: Boolean, default: true }
      },
      sms: {
        orderUpdates: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        security: { type: Boolean, default: true }
      },
      push: {
        orderUpdates: { type: Boolean, default: true },
        marketing: { type: Boolean, default: true },
        security: { type: Boolean, default: true }
      }
    }
  }
}, {
  timestamps: true
});

// Compound indexes for common query patterns
userSchema.index({ email: 1, isActive: 1 }); // Email + active status
userSchema.index({ role: 1, isActive: 1 }); // Role + active status
userSchema.index({ lastLogin: -1, isActive: 1 }); // Recent logins
userSchema.index({ createdAt: -1, isActive: 1 }); // Recent registrations
userSchema.index({ email: 1, passwordResetToken: 1 }); // Password reset lookups
userSchema.index({ email: 1, emailVerificationToken: 1 }); // Email verification lookups

// Text search index for name and email
userSchema.index({ 
  name: 'text', 
  email: 'text' 
}, {
  weights: {
    name: 10,
    email: 5
  }
});

// Geospatial index for address coordinates
userSchema.index({ 
  'addresses.coordinates': '2dsphere' 
});

// TTL index for password reset tokens (auto-delete after 10 minutes)
userSchema.index({ 
  passwordResetExpires: 1 
}, { 
  expireAfterSeconds: 600 
});

// TTL index for email verification tokens (auto-delete after 24 hours)
userSchema.index({ 
  emailVerificationExpires: 1 
}, { 
  expireAfterSeconds: 86400 
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: Date.now(), lastActivity: Date.now() }
  });
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

// MFA Methods
userSchema.methods.enableMFA = function(method, data) {
  this.mfaEnabled = true;
  
  // Remove existing method of same type
  this.mfaMethods = this.mfaMethods.filter(m => m.type !== method);
  
  // Add new method
  this.mfaMethods.push({
    type: method,
    ...data,
    enabled: true,
    createdAt: new Date()
  });
};

userSchema.methods.disableMFA = function(method = null) {
  if (method) {
    this.mfaMethods = this.mfaMethods.filter(m => m.type !== method);
    if (this.mfaMethods.length === 0) {
      this.mfaEnabled = false;
    }
  } else {
    this.mfaEnabled = false;
    this.mfaMethods = [];
    this.mfaBackupCodes = [];
  }
};

userSchema.methods.getMFAMethod = function(type) {
  return this.mfaMethods.find(m => m.type === type && m.enabled);
};

// Session Management
userSchema.methods.addSession = function(sessionId, deviceInfo) {
  // Remove old sessions if exceeding max
  if (this.activeSessions.length >= this.maxSessions) {
    this.activeSessions.sort((a, b) => b.lastActivity - a.lastActivity);
    this.activeSessions = this.activeSessions.slice(0, this.maxSessions - 1);
  }
  
  this.activeSessions.push({
    sessionId,
    deviceInfo,
    createdAt: new Date(),
    lastActivity: new Date(),
    isActive: true
  });
};

userSchema.methods.removeSession = function(sessionId) {
  this.activeSessions = this.activeSessions.filter(s => s.sessionId !== sessionId);
};

userSchema.methods.updateSessionActivity = function(sessionId) {
  const session = this.activeSessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
};

userSchema.methods.getActiveSessions = function() {
  return this.activeSessions.filter(s => s.isActive);
};

userSchema.methods.terminateAllSessions = function(exceptSessionId = null) {
  if (exceptSessionId) {
    this.activeSessions = this.activeSessions.filter(s => s.sessionId === exceptSessionId);
  } else {
    this.activeSessions = [];
  }
};

// Password Policy Methods
userSchema.methods.isPasswordReused = function(newPassword) {
  if (!this.passwordHistory || this.passwordHistory.length === 0) {
    return false;
  }
  
  // Check against last 5 passwords
  const recentPasswords = this.passwordHistory.slice(-5);
  return recentPasswords.some(p => bcrypt.compareSync(newPassword, p.hash));
};

userSchema.methods.addPasswordToHistory = function(passwordHash) {
  if (!this.passwordHistory) {
    this.passwordHistory = [];
  }
  
  this.passwordHistory.push({
    hash: passwordHash,
    createdAt: new Date()
  });
  
  // Keep only last 10 passwords
  if (this.passwordHistory.length > 10) {
    this.passwordHistory = this.passwordHistory.slice(-10);
  }
  
  this.passwordChangedAt = new Date();
};

userSchema.methods.isPasswordExpired = function() {
  if (!this.securitySettings?.passwordExpiryDays) {
    return false;
  }
  
  const expiryDate = new Date(this.passwordChangedAt);
  expiryDate.setDate(expiryDate.getDate() + this.securitySettings.passwordExpiryDays);
  
  return new Date() > expiryDate;
};

// API Key Management
userSchema.methods.generateAPIKey = function(name, permissions = []) {
  const keyId = crypto.randomUUID();
  const apiKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  this.apiKeys.push({
    name,
    keyId,
    keyHash,
    permissions,
    isActive: true,
    createdAt: new Date()
  });
  
  return { keyId, apiKey };
};

userSchema.methods.validateAPIKey = function(apiKey) {
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const foundKey = this.apiKeys.find(k => k.keyHash === keyHash && k.isActive);
  
  if (foundKey) {
    foundKey.lastUsed = new Date();
    return foundKey;
  }
  
  return null;
};

userSchema.methods.revokeAPIKey = function(keyId) {
  const apiKey = this.apiKeys.find(k => k.keyId === keyId);
  if (apiKey) {
    apiKey.isActive = false;
    return true;
  }
  return false;
};

// Social Provider Methods
userSchema.methods.addSocialProvider = function(provider, data) {
  // Remove existing provider of same type
  this.socialProviders = this.socialProviders.filter(p => p.provider !== provider);
  
  this.socialProviders.push({
    provider,
    providerId: data.id,
    email: data.email,
    name: data.name,
    avatar: data.avatar,
    connectedAt: new Date()
  });
};

userSchema.methods.removeSocialProvider = function(provider) {
  this.socialProviders = this.socialProviders.filter(p => p.provider !== provider);
};

userSchema.methods.getSocialProvider = function(provider) {
  return this.socialProviders.find(p => p.provider === provider);
};

// Security checks
userSchema.methods.isIPAllowed = function(ip) {
  if (!this.securitySettings?.allowedIPs || this.securitySettings.allowedIPs.length === 0) {
    return true;
  }
  return this.securitySettings.allowedIPs.includes(ip);
};

userSchema.methods.updateSecuritySettings = function(settings) {
  this.securitySettings = { ...this.securitySettings, ...settings };
};

userSchema.methods.updatePrivacySettings = function(settings) {
  this.privacySettings = { ...this.privacySettings, ...settings };
};

userSchema.methods.updatePreferences = function(preferences) {
  this.preferences = { ...this.preferences, ...preferences };
};

// Enhanced toJSON method to exclude sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  
  // Remove sensitive fields
  delete user.password;
  delete user.passwordHistory;
  delete user.mfaBackupCodes;
  delete user.apiKeys;
  delete user.activeSessions;
  
  // Remove sensitive parts of MFA methods
  if (user.mfaMethods) {
    user.mfaMethods = user.mfaMethods.map(method => ({
      type: method.type,
      enabled: method.enabled,
      createdAt: method.createdAt,
      // Don't expose secrets, phone numbers, etc.
      masked: this.maskMFAMethod(method)
    }));
  }
  
  return user;
};

userSchema.methods.maskMFAMethod = function(method) {
  switch (method.type) {
    case 'sms':
      return method.phoneNumber ? method.phoneNumber.replace(/(\d{3})\d{6}(\d{3})/, '$1****$2') : '';
    case 'email':
      return method.email ? method.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '';
    case 'totp':
      return 'Authenticator App';
    default:
      return method.type;
  }
};

export default mongoose.model('User', userSchema); 