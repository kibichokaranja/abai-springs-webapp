import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { notificationService } from './notificationService.js';
import logger from '../utils/logger.js';

class PasswordPolicyService {
  constructor() {
    this.defaultPolicy = {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      forbidCommonPasswords: true,
      forbidPersonalInfo: true,
      maxRepeatingChars: 3,
      minPasswordAge: 24 * 60 * 60 * 1000, // 24 hours
      maxPasswordAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      passwordHistoryCount: 5,
      complexityScore: 60, // Minimum complexity score out of 100
      forbiddenPatterns: [
        /(.)\1{2,}/g, // More than 2 repeating characters
        /123|234|345|456|567|678|789|890/g, // Sequential numbers
        /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/gi, // Sequential letters
        /qwerty|asdf|zxcv|password|admin|user|guest|root/gi // Common patterns
      ]
    };

    this.commonPasswords = new Set([
      'password', 'password123', '123456', '123456789', 'qwerty', 'abc123',
      'password1', 'admin', 'letmein', 'welcome', 'monkey', '1234567890',
      'dragon', 'master', 'hello', 'login', 'pass', 'admin123', 'root',
      'guest', 'user', 'test', 'demo', '12345678', 'superman', 'batman',
      'football', 'baseball', 'basketball', 'soccer', 'hockey', 'tennis',
      'golf', 'swimming', 'running', 'cycling', 'dancing', 'singing',
      'january', 'february', 'march', 'april', 'may', 'june', 'july',
      'august', 'september', 'october', 'november', 'december'
    ]);
  }

  // Validate password against policy
  validatePassword(password, user = null, customPolicy = null) {
    const policy = customPolicy || this.defaultPolicy;
    const errors = [];
    const warnings = [];

    // Check minimum length
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    // Check maximum length
    if (password.length > policy.maxLength) {
      errors.push(`Password must not exceed ${policy.maxLength} characters`);
    }

    // Check uppercase requirement
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check lowercase requirement
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check numbers requirement
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check special characters requirement
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check against common passwords
    if (policy.forbidCommonPasswords && this.isCommonPassword(password)) {
      errors.push('Password is too common. Please choose a more unique password');
    }

    // Check for forbidden patterns
    if (policy.forbiddenPatterns) {
      for (const pattern of policy.forbiddenPatterns) {
        if (pattern.test(password)) {
          errors.push('Password contains forbidden patterns');
          break;
        }
      }
    }

    // Check repeating characters
    if (policy.maxRepeatingChars) {
      const maxRepeats = this.getMaxRepeatingChars(password);
      if (maxRepeats > policy.maxRepeatingChars) {
        errors.push(`Password cannot have more than ${policy.maxRepeatingChars} repeating characters`);
      }
    }

    // Check personal information (if user provided)
    if (policy.forbidPersonalInfo && user) {
      const personalInfo = this.extractPersonalInfo(user);
      if (this.containsPersonalInfo(password, personalInfo)) {
        errors.push('Password cannot contain personal information');
      }
    }

    // Calculate complexity score
    const complexityScore = this.calculateComplexityScore(password);
    if (complexityScore < policy.complexityScore) {
      warnings.push(`Password complexity is low (${complexityScore}/100). Consider making it more complex`);
    }

    // Check password age (if user provided)
    if (user && user.passwordChangedAt) {
      const passwordAge = Date.now() - user.passwordChangedAt.getTime();
      
      if (policy.minPasswordAge && passwordAge < policy.minPasswordAge) {
        errors.push(`Password was changed too recently. Wait ${Math.ceil((policy.minPasswordAge - passwordAge) / (60 * 60 * 1000))} hours`);
      }
      
      if (policy.maxPasswordAge && passwordAge > policy.maxPasswordAge) {
        warnings.push('Password has expired and should be changed');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      complexityScore,
      strength: this.getPasswordStrength(complexityScore)
    };
  }

  // Check if password is in history
  async isPasswordInHistory(user, newPassword) {
    if (!user.passwordHistory || user.passwordHistory.length === 0) {
      return false;
    }

    const historyCount = this.defaultPolicy.passwordHistoryCount;
    const recentPasswords = user.passwordHistory.slice(-historyCount);

    for (const oldPassword of recentPasswords) {
      if (await bcrypt.compare(newPassword, oldPassword.hash)) {
        return true;
      }
    }

    return false;
  }

  // Generate secure password
  generateSecurePassword(length = 16, includeSymbols = true) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = includeSymbols ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    let password = '';
    
    // Ensure at least one character from each required set
    password += this.getRandomChar(lowercase);
    password += this.getRandomChar(uppercase);
    password += this.getRandomChar(numbers);
    if (includeSymbols) {
      password += this.getRandomChar(symbols);
    }
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += this.getRandomChar(allChars);
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // Check password strength and provide recommendations
  analyzePassword(password) {
    const analysis = {
      length: password.length,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      hasCommonPatterns: this.hasCommonPatterns(password),
      entropy: this.calculateEntropy(password),
      complexityScore: this.calculateComplexityScore(password),
      estimatedCrackTime: this.estimateCrackTime(password),
      recommendations: []
    };

    // Generate recommendations
    if (analysis.length < 12) {
      analysis.recommendations.push('Use at least 12 characters');
    }
    if (!analysis.hasUppercase) {
      analysis.recommendations.push('Add uppercase letters');
    }
    if (!analysis.hasLowercase) {
      analysis.recommendations.push('Add lowercase letters');
    }
    if (!analysis.hasNumbers) {
      analysis.recommendations.push('Add numbers');
    }
    if (!analysis.hasSpecialChars) {
      analysis.recommendations.push('Add special characters');
    }
    if (analysis.hasCommonPatterns) {
      analysis.recommendations.push('Avoid common patterns and words');
    }
    if (analysis.entropy < 50) {
      analysis.recommendations.push('Increase randomness and unpredictability');
    }

    analysis.strength = this.getPasswordStrength(analysis.complexityScore);
    
    return analysis;
  }

  // Calculate password entropy
  calculateEntropy(password) {
    const charsetSize = this.getCharsetSize(password);
    return Math.log2(Math.pow(charsetSize, password.length));
  }

  // Calculate complexity score (0-100)
  calculateComplexityScore(password) {
    let score = 0;
    
    // Length scoring (up to 25 points)
    score += Math.min(password.length * 2, 25);
    
    // Character diversity (up to 40 points)
    let charTypes = 0;
    if (/[a-z]/.test(password)) charTypes++;
    if (/[A-Z]/.test(password)) charTypes++;
    if (/\d/.test(password)) charTypes++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) charTypes++;
    score += charTypes * 10;
    
    // Entropy bonus (up to 20 points)
    const entropy = this.calculateEntropy(password);
    score += Math.min(entropy / 4, 20);
    
    // Penalties
    if (this.isCommonPassword(password)) score -= 30;
    if (this.hasCommonPatterns(password)) score -= 20;
    if (this.getMaxRepeatingChars(password) > 2) score -= 10;
    
    return Math.max(0, Math.min(100, Math.floor(score)));
  }

  // Estimate crack time
  estimateCrackTime(password) {
    const entropy = this.calculateEntropy(password);
    const guessesPerSecond = 1000000; // Assume 1M guesses per second
    const secondsToCrack = Math.pow(2, entropy - 1) / guessesPerSecond;
    
    if (secondsToCrack < 60) return 'Less than a minute';
    if (secondsToCrack < 3600) return `${Math.floor(secondsToCrack / 60)} minutes`;
    if (secondsToCrack < 86400) return `${Math.floor(secondsToCrack / 3600)} hours`;
    if (secondsToCrack < 31536000) return `${Math.floor(secondsToCrack / 86400)} days`;
    if (secondsToCrack < 31536000000) return `${Math.floor(secondsToCrack / 31536000)} years`;
    return 'Centuries';
  }

  // Check for password expiry and send notifications
  async checkPasswordExpiry(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const passwordAge = Date.now() - user.passwordChangedAt.getTime();
      const expiryDays = user.securitySettings?.passwordExpiryDays || this.defaultPolicy.maxPasswordAge / (24 * 60 * 60 * 1000);
      const expiryTime = expiryDays * 24 * 60 * 60 * 1000;
      
      const daysUntilExpiry = Math.floor((expiryTime - passwordAge) / (24 * 60 * 60 * 1000));
      
      // Send notification if password expires soon
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        await this.sendPasswordExpiryNotification(user, daysUntilExpiry);
      } else if (daysUntilExpiry <= 0) {
        await this.sendPasswordExpiredNotification(user);
      }
      
      return daysUntilExpiry;
    } catch (error) {
      logger.error('Failed to check password expiry:', error);
    }
  }

  // Send password expiry notification
  async sendPasswordExpiryNotification(user, daysUntilExpiry) {
    try {
      const subject = 'Password Expiry Warning - Abai Springs';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #ffc107; padding: 20px; text-align: center;">
            <h1 style="color: #212529; margin: 0;">Password Expiry Warning</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${user.name},</h2>
            <p style="color: #666; font-size: 16px;">
              Your password will expire in <strong>${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}</strong>.
            </p>
            <p style="color: #666; font-size: 16px;">
              To ensure continued access to your account, please change your password before it expires.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/change-password" 
                 style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Change Password
              </a>
            </div>
            <p style="color: #999; font-size: 14px;">
              This is an automated security notification. If you recently changed your password, you can ignore this message.
            </p>
          </div>
        </div>
      `;
      
      await notificationService.sendEmail(user.email, subject, html);
      
      // Update notification sent timestamp to avoid spam
      user.passwordExpireNotification = new Date();
      await user.save();
      
      logger.info('Password expiry notification sent', { userId: user._id, daysUntilExpiry });
    } catch (error) {
      logger.error('Failed to send password expiry notification:', error);
    }
  }

  // Send password expired notification
  async sendPasswordExpiredNotification(user) {
    try {
      const subject = 'Password Expired - Abai Springs';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc3545; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Password Expired</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${user.name},</h2>
            <p style="color: #666; font-size: 16px;">
              Your password has expired and must be changed before you can access your account.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/forgot-password" 
                 style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #999; font-size: 14px;">
              For security reasons, expired passwords cannot be used to access your account.
            </p>
          </div>
        </div>
      `;
      
      await notificationService.sendEmail(user.email, subject, html);
      logger.info('Password expired notification sent', { userId: user._id });
    } catch (error) {
      logger.error('Failed to send password expired notification:', error);
    }
  }

  // Helper methods
  isCommonPassword(password) {
    return this.commonPasswords.has(password.toLowerCase());
  }

  hasCommonPatterns(password) {
    return this.defaultPolicy.forbiddenPatterns.some(pattern => pattern.test(password));
  }

  getMaxRepeatingChars(password) {
    let maxRepeats = 1;
    let currentRepeats = 1;
    
    for (let i = 1; i < password.length; i++) {
      if (password[i] === password[i - 1]) {
        currentRepeats++;
      } else {
        maxRepeats = Math.max(maxRepeats, currentRepeats);
        currentRepeats = 1;
      }
    }
    
    return Math.max(maxRepeats, currentRepeats);
  }

  extractPersonalInfo(user) {
    const info = [];
    if (user.name) info.push(...user.name.toLowerCase().split(' '));
    if (user.email) info.push(user.email.toLowerCase().split('@')[0]);
    if (user.phone) info.push(user.phone.replace(/\D/g, ''));
    return info;
  }

  containsPersonalInfo(password, personalInfo) {
    const lowerPassword = password.toLowerCase();
    return personalInfo.some(info => 
      info.length > 2 && lowerPassword.includes(info.toLowerCase())
    );
  }

  getCharsetSize(password) {
    let size = 0;
    if (/[a-z]/.test(password)) size += 26;
    if (/[A-Z]/.test(password)) size += 26;
    if (/\d/.test(password)) size += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) size += 32;
    return size || 1;
  }

  getPasswordStrength(score) {
    if (score >= 80) return 'Very Strong';
    if (score >= 60) return 'Strong';
    if (score >= 40) return 'Moderate';
    if (score >= 20) return 'Weak';
    return 'Very Weak';
  }

  getRandomChar(charset) {
    return charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Get password policy for user
  getPasswordPolicy(user = null) {
    if (user && user.securitySettings) {
      return {
        ...this.defaultPolicy,
        ...user.securitySettings.passwordPolicy
      };
    }
    return this.defaultPolicy;
  }

  // Update user's password policy
  async updatePasswordPolicy(userId, policyUpdates) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.securitySettings) {
        user.securitySettings = {};
      }

      user.securitySettings.passwordPolicy = {
        ...this.defaultPolicy,
        ...user.securitySettings.passwordPolicy,
        ...policyUpdates
      };

      await user.save();
      logger.info('Password policy updated', { userId, policyUpdates });
      
      return user.securitySettings.passwordPolicy;
    } catch (error) {
      logger.error('Failed to update password policy:', error);
      throw error;
    }
  }
}

export default new PasswordPolicyService();









