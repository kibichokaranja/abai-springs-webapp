import express from 'express';
import { body, param } from 'express-validator';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/validate.js';
import { authRateLimit, passwordResetRateLimit } from '../middleware/rateLimiting.js';
import {
  sendSuccess,
  sendError,
  sendCreated,
  sendUnauthorized,
  sendValidationError
} from '../utils/responseHandler.js';
import mfaService from '../services/mfaService.js';
import socialAuthService from '../services/socialAuthService.js';
import notificationService from '../services/notificationService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Validation schemas
const mfaSetupValidation = [
  body('method')
    .isIn(['totp', 'sms', 'email'])
    .withMessage('Invalid MFA method'),
  body('token')
    .isLength({ min: 6, max: 6 })
    .withMessage('Token must be 6 digits')
    .isNumeric()
    .withMessage('Token must be numeric')
];

const passwordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

// ======================
// MFA ENDPOINTS
// ======================

// @desc    Setup TOTP MFA
// @route   POST /api/auth/mfa/setup/totp
// @access  Private
router.post('/mfa/setup/totp', authenticate, asyncHandler(async (req, res) => {
  const user = req.user;

  // Generate TOTP secret
  const totpData = mfaService.generateTOTPSecret(user.email);
  const qrCode = await mfaService.generateQRCode(totpData.qrCode);

  // Store secret temporarily (will be saved when user verifies)
  await mfaService.storeOTP(user._id, totpData.secret, 'totp_setup');

  return sendSuccess(res, {
    message: 'TOTP setup initiated',
    data: {
      secret: totpData.secret,
      qrCode,
      backupCodes: totpData.backupCodes
    }
  });
}));

// @desc    Verify and enable TOTP MFA
// @route   POST /api/auth/mfa/setup/totp/verify
// @access  Private
router.post('/mfa/setup/totp/verify', 
  authenticate, 
  mfaSetupValidation, 
  asyncHandler(async (req, res) => {
    const { token, secret } = req.body;
    const user = await User.findById(req.user._id);

    // Verify TOTP token
    if (!mfaService.verifyTOTP(token, secret)) {
      throw new ApiError('Invalid TOTP token', 400);
    }

    // Enable MFA
    const backupCodes = mfaService.generateBackupCodes();
    user.enableMFA('totp', { secret });
    user.mfaBackupCodes = backupCodes;
    await user.save();

    logger.info('TOTP MFA enabled', { userId: user._id });

    return sendSuccess(res, {
      message: 'TOTP MFA enabled successfully',
      data: { backupCodes }
    });
  })
);

// @desc    Setup SMS MFA
// @route   POST /api/auth/mfa/setup/sms
// @access  Private
router.post('/mfa/setup/sms', authenticate, [
  body('phoneNumber')
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Invalid phone number format')
], asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;
  
  // Send SMS OTP
  await mfaService.sendSMSOTP(phoneNumber, 'setup');

  return sendSuccess(res, {
    message: 'SMS OTP sent successfully',
    data: { phoneNumber: phoneNumber.replace(/(\d{3})\d{6}(\d{3})/, '$1****$2') }
  });
}));

// @desc    Verify and enable SMS MFA
// @route   POST /api/auth/mfa/setup/sms/verify
// @access  Private
router.post('/mfa/setup/sms/verify', 
  authenticate, 
  mfaSetupValidation, 
  asyncHandler(async (req, res) => {
    const { phoneNumber, token } = req.body;
    const user = await User.findById(req.user._id);

    // Verify SMS OTP
    await mfaService.verifyOTP(phoneNumber, token, 'setup');

    // Enable MFA
    const backupCodes = mfaService.generateBackupCodes();
    user.enableMFA('sms', { phoneNumber });
    user.mfaBackupCodes = backupCodes;
    await user.save();

    logger.info('SMS MFA enabled', { userId: user._id });

    return sendSuccess(res, {
      message: 'SMS MFA enabled successfully',
      data: { backupCodes }
    });
  })
);

// @desc    Setup Email MFA
// @route   POST /api/auth/mfa/setup/email
// @access  Private
router.post('/mfa/setup/email', authenticate, [
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
], asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  // Send Email OTP
  await mfaService.sendEmailOTP(email, 'setup');

  return sendSuccess(res, {
    message: 'Email OTP sent successfully',
    data: { email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') }
  });
}));

// @desc    Verify and enable Email MFA
// @route   POST /api/auth/mfa/setup/email/verify
// @access  Private
router.post('/mfa/setup/email/verify', 
  authenticate, 
  mfaSetupValidation, 
  asyncHandler(async (req, res) => {
    const { email, token } = req.body;
    const user = await User.findById(req.user._id);

    // Verify Email OTP
    await mfaService.verifyOTP(email, token, 'setup');

    // Enable MFA
    const backupCodes = mfaService.generateBackupCodes();
    user.enableMFA('email', { email });
    user.mfaBackupCodes = backupCodes;
    await user.save();

    logger.info('Email MFA enabled', { userId: user._id });

    return sendSuccess(res, {
      message: 'Email MFA enabled successfully',
      data: { backupCodes }
    });
  })
);

// @desc    Get MFA status
// @route   GET /api/auth/mfa/status
// @access  Private
router.get('/mfa/status', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const mfaStatus = mfaService.getMFAStatus(user);

  return sendSuccess(res, {
    message: 'MFA status retrieved',
    data: mfaStatus
  });
}));

// @desc    Disable MFA
// @route   DELETE /api/auth/mfa/disable
// @access  Private
router.delete('/mfa/disable', authenticate, [
  body('method')
    .optional()
    .isIn(['totp', 'sms', 'email'])
    .withMessage('Invalid MFA method'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
], asyncHandler(async (req, res) => {
  const { method, password } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  // Verify password
  if (!await user.comparePassword(password)) {
    throw new ApiError('Invalid password', 401);
  }

  // Disable MFA
  user.disableMFA(method);
  await user.save();

  logger.info('MFA disabled', { userId: user._id, method: method || 'all' });

  return sendSuccess(res, {
    message: method ? `${method} MFA disabled` : 'All MFA methods disabled'
  });
}));

// @desc    Verify MFA challenge
// @route   POST /api/auth/mfa/verify
// @access  Public (but requires valid challenge)
router.post('/mfa/verify', [
  body('challengeId')
    .isUUID()
    .withMessage('Invalid challenge ID'),
  body('method')
    .isIn(['totp', 'sms', 'email', 'backup'])
    .withMessage('Invalid MFA method'),
  body('token')
    .isLength({ min: 6 })
    .withMessage('Token is required')
], asyncHandler(async (req, res) => {
  const { challengeId, method, token } = req.body;

  // Verify MFA challenge
  await mfaService.verifyMFAChallenge(challengeId, method, token);

  return sendSuccess(res, {
    message: 'MFA verification successful'
  });
}));

// ======================
// SOCIAL LOGIN ENDPOINTS
// ======================

// @desc    Get available social providers
// @route   GET /api/auth/social/providers
// @access  Public
router.get('/social/providers', asyncHandler(async (req, res) => {
  const providers = socialAuthService.getAvailableProviders();

  return sendSuccess(res, {
    message: 'Available social providers',
    data: providers
  });
}));

// @desc    Google OAuth login
// @route   POST /api/auth/social/google
// @access  Public
router.post('/social/google', authRateLimit, [
  body('token')
    .isLength({ min: 1 })
    .withMessage('Google token is required'),
  body('isCode')
    .optional()
    .isBoolean()
    .withMessage('isCode must be boolean')
], asyncHandler(async (req, res) => {
  const { token, isCode = false } = req.body;

  const result = await socialAuthService.socialLogin('google', token, isCode);

  return sendSuccess(res, {
    message: result.isNewUser ? 'Account created and logged in' : 'Logged in successfully',
    data: result
  });
}));

// @desc    Facebook OAuth login
// @route   POST /api/auth/social/facebook
// @access  Public
router.post('/social/facebook', authRateLimit, [
  body('token')
    .isLength({ min: 1 })
    .withMessage('Facebook token is required'),
  body('isCode')
    .optional()
    .isBoolean()
    .withMessage('isCode must be boolean')
], asyncHandler(async (req, res) => {
  const { token, isCode = false } = req.body;

  const result = await socialAuthService.socialLogin('facebook', token, isCode);

  return sendSuccess(res, {
    message: result.isNewUser ? 'Account created and logged in' : 'Logged in successfully',
    data: result
  });
}));

// @desc    Apple Sign-In login
// @route   POST /api/auth/social/apple
// @access  Public
router.post('/social/apple', authRateLimit, [
  body('identityToken')
    .isLength({ min: 1 })
    .withMessage('Apple identity token is required'),
  body('authorizationCode')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Invalid authorization code')
], asyncHandler(async (req, res) => {
  const { identityToken, authorizationCode } = req.body;

  const result = await socialAuthService.socialLogin('apple', identityToken);

  return sendSuccess(res, {
    message: result.isNewUser ? 'Account created and logged in' : 'Logged in successfully',
    data: result
  });
}));

// @desc    Link social account
// @route   POST /api/auth/social/link/:provider
// @access  Private
router.post('/social/link/:provider', authenticate, [
  param('provider')
    .isIn(['google', 'facebook', 'apple'])
    .withMessage('Invalid social provider'),
  body('token')
    .isLength({ min: 1 })
    .withMessage('Token is required'),
  body('isCode')
    .optional()
    .isBoolean()
    .withMessage('isCode must be boolean')
], asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { token, isCode = false } = req.body;

  const result = await socialAuthService.linkSocialAccount(req.user._id, provider, token, isCode);

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
}));

// @desc    Unlink social account
// @route   DELETE /api/auth/social/unlink/:provider
// @access  Private
router.delete('/social/unlink/:provider', authenticate, [
  param('provider')
    .isIn(['google', 'facebook', 'apple'])
    .withMessage('Invalid social provider')
], asyncHandler(async (req, res) => {
  const { provider } = req.params;

  const result = await socialAuthService.unlinkSocialAccount(req.user._id, provider);

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
}));

// ======================
// SESSION MANAGEMENT
// ======================

// @desc    Get active sessions
// @route   GET /api/auth/sessions
// @access  Private
router.get('/sessions', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const sessions = user.getActiveSessions();

  return sendSuccess(res, {
    message: 'Active sessions retrieved',
    data: sessions.map(session => ({
      sessionId: session.sessionId,
      deviceInfo: session.deviceInfo,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      isCurrent: session.sessionId === req.sessionId
    }))
  });
}));

// @desc    Terminate session
// @route   DELETE /api/auth/sessions/:sessionId
// @access  Private
router.delete('/sessions/:sessionId', authenticate, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const user = await User.findById(req.user._id);

  user.removeSession(sessionId);
  await user.save();

  return sendSuccess(res, {
    message: 'Session terminated successfully'
  });
}));

// @desc    Terminate all sessions except current
// @route   DELETE /api/auth/sessions/terminate-all
// @access  Private
router.delete('/sessions/terminate-all', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  user.terminateAllSessions(req.sessionId);
  await user.save();

  return sendSuccess(res, {
    message: 'All other sessions terminated successfully'
  });
}));

// ======================
// PASSWORD MANAGEMENT
// ======================

// @desc    Change password with policy enforcement
// @route   PUT /api/auth/password/change
// @access  Private
router.put('/password/change', authenticate, [
  body('currentPassword')
    .isLength({ min: 1 })
    .withMessage('Current password is required'),
  ...passwordValidation
], asyncHandler(async (req, res) => {
  const { currentPassword, password } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  if (!await user.comparePassword(currentPassword)) {
    throw new ApiError('Current password is incorrect', 401);
  }

  // Check password reuse
  if (user.isPasswordReused(password)) {
    throw new ApiError('Cannot reuse recent passwords', 400);
  }

  // Update password
  const oldPasswordHash = user.password;
  user.password = password;
  user.addPasswordToHistory(oldPasswordHash);
  await user.save();

  logger.info('Password changed', { userId: user._id });

  return sendSuccess(res, {
    message: 'Password changed successfully'
  });
}));

// @desc    Check password expiry
// @route   GET /api/auth/password/expiry
// @access  Private
router.get('/password/expiry', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const isExpired = user.isPasswordExpired();
  
  let daysUntilExpiry = null;
  if (!isExpired && user.securitySettings?.passwordExpiryDays) {
    const expiryDate = new Date(user.passwordChangedAt);
    expiryDate.setDate(expiryDate.getDate() + user.securitySettings.passwordExpiryDays);
    daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (24 * 60 * 60 * 1000));
  }

  return sendSuccess(res, {
    message: 'Password expiry status',
    data: {
      isExpired,
      daysUntilExpiry,
      passwordChangedAt: user.passwordChangedAt
    }
  });
}));

// ======================
// API KEY MANAGEMENT
// ======================

// @desc    Generate API key
// @route   POST /api/auth/api-keys
// @access  Private
router.post('/api-keys', authenticate, [
  body('name')
    .isLength({ min: 1, max: 50 })
    .withMessage('API key name is required (max 50 characters)'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
], asyncHandler(async (req, res) => {
  const { name, permissions = [] } = req.body;
  const user = await User.findById(req.user._id);

  const apiKeyData = user.generateAPIKey(name, permissions);
  await user.save();

  logger.info('API key generated', { userId: user._id, keyName: name });

  return sendCreated(res, {
    message: 'API key generated successfully',
    data: {
      keyId: apiKeyData.keyId,
      apiKey: apiKeyData.apiKey,
      name,
      permissions
    }
  });
}));

// @desc    Get API keys
// @route   GET /api/auth/api-keys
// @access  Private
router.get('/api-keys', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  const apiKeys = user.apiKeys.map(key => ({
    keyId: key.keyId,
    name: key.name,
    permissions: key.permissions,
    isActive: key.isActive,
    lastUsed: key.lastUsed,
    createdAt: key.createdAt
  }));

  return sendSuccess(res, {
    message: 'API keys retrieved',
    data: apiKeys
  });
}));

// @desc    Revoke API key
// @route   DELETE /api/auth/api-keys/:keyId
// @access  Private
router.delete('/api-keys/:keyId', authenticate, asyncHandler(async (req, res) => {
  const { keyId } = req.params;
  const user = await User.findById(req.user._id);

  const success = user.revokeAPIKey(keyId);
  if (!success) {
    throw new ApiError('API key not found', 404);
  }

  await user.save();

  logger.info('API key revoked', { userId: user._id, keyId });

  return sendSuccess(res, {
    message: 'API key revoked successfully'
  });
}));

export default router;
