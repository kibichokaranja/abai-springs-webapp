import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import notificationService from './notificationService.js';
import logger from '../utils/logger.js';
import cacheManager from '../utils/cache.js';

class MFAService {
  constructor() {
    this.otpLength = 6;
    this.otpExpiryMinutes = 5;
    this.maxAttempts = 3;
  }

  // Generate TOTP secret for authenticator apps
  generateTOTPSecret(userEmail) {
    const secret = speakeasy.generateSecret({
      name: `Abai Springs (${userEmail})`,
      issuer: 'Abai Springs',
      length: 32
    });

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url,
      backupCodes: this.generateBackupCodes()
    };
  }

  // Generate QR code for TOTP setup
  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataURL;
    } catch (error) {
      logger.error('QR Code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  // Verify TOTP token
  verifyTOTP(token, secret) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps (60 seconds) variance
    });
  }

  // Generate backup codes for account recovery
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  // Generate OTP for SMS/Email
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store OTP with expiry
  async storeOTP(identifier, otp, type = 'login') {
    const key = `mfa_otp:${type}:${identifier}`;
    const data = {
      otp,
      attempts: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000)
    };

    await cacheManager.set(key, data, this.otpExpiryMinutes * 60);
    return otp;
  }

  // Verify OTP
  async verifyOTP(identifier, providedOTP, type = 'login') {
    const key = `mfa_otp:${type}:${identifier}`;
    const storedData = await cacheManager.get(key);

    if (!storedData) {
      throw new Error('OTP expired or not found');
    }

    if (storedData.attempts >= this.maxAttempts) {
      await cacheManager.del(key);
      throw new Error('Maximum OTP attempts exceeded');
    }

    if (storedData.otp !== providedOTP) {
      storedData.attempts += 1;
      await cacheManager.set(key, storedData, this.otpExpiryMinutes * 60);
      throw new Error('Invalid OTP');
    }

    // OTP verified successfully, remove from cache
    await cacheManager.del(key);
    return true;
  }

  // Send SMS OTP
  async sendSMSOTP(phoneNumber, type = 'login') {
    try {
      const otp = this.generateOTP();
      await this.storeOTP(phoneNumber, otp, type);

      const message = `Your Abai Springs verification code is: ${otp}. Valid for ${this.otpExpiryMinutes} minutes. Don't share this code with anyone.`;
      
      await notificationService.sendWhatsApp(phoneNumber, message);
      
      logger.info('SMS OTP sent', { 
        phoneNumber: phoneNumber.replace(/(\d{3})\d{6}(\d{3})/, '$1****$2'), 
        type 
      });

      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      logger.error('SMS OTP sending failed:', error);
      throw new Error('Failed to send SMS OTP');
    }
  }

  // Send Email OTP
  async sendEmailOTP(email, type = 'login') {
    try {
      const otp = this.generateOTP();
      await this.storeOTP(email, otp, type);

      const subject = 'Abai Springs - Verification Code';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Abai Springs</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Verification Code</h2>
            <p style="color: #666; font-size: 16px;">Your verification code is:</p>
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px;">
              This code is valid for ${this.otpExpiryMinutes} minutes. Don't share this code with anyone.
            </p>
            <p style="color: #999; font-size: 12px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        </div>
      `;

      await notificationService.sendEmail(email, subject, html);
      
      logger.info('Email OTP sent', { 
        email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), 
        type 
      });

      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      logger.error('Email OTP sending failed:', error);
      throw new Error('Failed to send email OTP');
    }
  }

  // Enable MFA for user
  async enableMFA(userId, method, data) {
    const methods = {
      totp: async (data) => {
        const { secret, token } = data;
        if (!this.verifyTOTP(token, secret)) {
          throw new Error('Invalid TOTP token');
        }
        return { secret, backupCodes: this.generateBackupCodes() };
      },
      sms: async (data) => {
        const { phoneNumber, otp } = data;
        await this.verifyOTP(phoneNumber, otp, 'setup');
        return { phoneNumber };
      },
      email: async (data) => {
        const { email, otp } = data;
        await this.verifyOTP(email, otp, 'setup');
        return { email };
      }
    };

    if (!methods[method]) {
      throw new Error('Invalid MFA method');
    }

    const mfaData = await methods[method](data);
    
    logger.info('MFA enabled', { userId, method });
    return { method, ...mfaData };
  }

  // Verify backup code
  async verifyBackupCode(userId, backupCodes, providedCode) {
    const normalizedCode = providedCode.toUpperCase().replace('-', '');
    const codeIndex = backupCodes.findIndex(code => 
      code.replace('-', '') === normalizedCode
    );

    if (codeIndex === -1) {
      throw new Error('Invalid backup code');
    }

    // Remove used backup code
    backupCodes.splice(codeIndex, 1);
    
    logger.info('Backup code used', { userId, remainingCodes: backupCodes.length });
    return backupCodes;
  }

  // Check if MFA is required
  requiresMFA(user, action = 'login') {
    if (!user.mfaEnabled) return false;

    const highRiskActions = ['login', 'password_change', 'settings_update', 'payment'];
    return highRiskActions.includes(action);
  }

  // Generate MFA challenge
  async generateMFAChallenge(user, action = 'login') {
    const challengeId = crypto.randomUUID();
    const challenge = {
      id: challengeId,
      userId: user._id,
      action,
      availableMethods: user.mfaMethods || [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };

    await cacheManager.set(`mfa_challenge:${challengeId}`, challenge, 10 * 60);
    
    return {
      challengeId,
      availableMethods: challenge.availableMethods.map(method => ({
        type: method.type,
        masked: this.maskSensitiveData(method)
      }))
    };
  }

  // Verify MFA challenge
  async verifyMFAChallenge(challengeId, method, token) {
    const challenge = await cacheManager.get(`mfa_challenge:${challengeId}`);
    
    if (!challenge) {
      throw new Error('Invalid or expired MFA challenge');
    }

    const userMethod = challenge.availableMethods.find(m => m.type === method);
    if (!userMethod) {
      throw new Error('MFA method not available for this user');
    }

    let verified = false;

    switch (method) {
      case 'totp':
        verified = this.verifyTOTP(token, userMethod.secret);
        break;
      case 'sms':
        verified = await this.verifyOTP(userMethod.phoneNumber, token, 'login');
        break;
      case 'email':
        verified = await this.verifyOTP(userMethod.email, token, 'login');
        break;
      default:
        throw new Error('Unsupported MFA method');
    }

    if (!verified) {
      throw new Error('Invalid MFA token');
    }

    // Clean up challenge
    await cacheManager.del(`mfa_challenge:${challengeId}`);
    
    logger.info('MFA challenge verified', { 
      challengeId, 
      userId: challenge.userId, 
      method,
      action: challenge.action 
    });

    return true;
  }

  // Mask sensitive data for display
  maskSensitiveData(method) {
    switch (method.type) {
      case 'sms':
        return method.phoneNumber.replace(/(\d{3})\d{6}(\d{3})/, '$1****$2');
      case 'email':
        return method.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      case 'totp':
        return 'Authenticator App';
      default:
        return method.type;
    }
  }

  // Disable MFA for user
  async disableMFA(userId, method = null) {
    logger.info('MFA disabled', { userId, method });
    return true;
  }

  // Get MFA status for user
  getMFAStatus(user) {
    return {
      enabled: user.mfaEnabled || false,
      methods: (user.mfaMethods || []).map(method => ({
        type: method.type,
        masked: this.maskSensitiveData(method),
        enabled: method.enabled,
        createdAt: method.createdAt
      })),
      backupCodesRemaining: user.mfaBackupCodes ? user.mfaBackupCodes.length : 0
    };
  }
}

export default new MFAService();






