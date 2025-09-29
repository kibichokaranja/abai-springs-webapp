import express from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateEnhanced } from '../middleware/authEnhanced.js';
import { asyncHandler, ApiError } from '../middleware/validate.js';
import { authRateLimit } from '../middleware/rateLimiting.js';
import {
  sendSuccess,
  sendError,
  sendUnauthorized,
  sendValidationError
} from '../utils/responseHandler.js';
import tokenService from '../services/tokenService.js';
import sessionService from '../services/sessionService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// @desc    Refresh access token
// @route   POST /api/auth/token/refresh
// @access  Public (but requires valid refresh token)
router.post('/refresh', authRateLimit, [
  body('refreshToken')
    .isLength({ min: 1 })
    .withMessage('Refresh token is required')
], asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  // Get device info from request
  const deviceInfo = {
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    location: req.get('X-Forwarded-For') || req.connection.remoteAddress
  };

  // Refresh tokens
  const newTokens = await tokenService.refreshTokens(refreshToken, deviceInfo);

  return sendSuccess(res, {
    message: 'Token refreshed successfully',
    data: newTokens
  });
}));

// @desc    Login with enhanced token generation
// @route   POST /api/auth/token/login
// @access  Public
router.post('/login', authRateLimit, [
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
], asyncHandler(async (req, res) => {
  const { email, password, rememberMe = false } = req.body;

  // Find user
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ApiError('Invalid credentials', 401);
  }

  // Check if user is active
  if (!user.isActive) {
    throw new ApiError('Account is deactivated', 401);
  }

  // Check if account is locked
  if (user.isLocked()) {
    throw new ApiError('Account is temporarily locked', 423);
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    await user.incLoginAttempts();
    throw new ApiError('Invalid credentials', 401);
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  // Get device info
  const deviceInfo = {
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    location: req.get('X-Forwarded-For') || req.connection.remoteAddress
  };

  // Create session
  const sessionId = await sessionService.createSession(
    user._id, 
    deviceInfo,
    rememberMe ? 30 * 24 * 60 * 60 : null // 30 days if remember me
  );

  // Generate token pair
  const tokens = await tokenService.generateTokenPair(user, sessionId, deviceInfo);

  // Update user last login
  user.lastLogin = new Date();
  await user.save();

  logger.info('User logged in', {
    userId: user._id,
    email: user.email,
    sessionId,
    deviceType: deviceInfo.deviceType,
    ip: deviceInfo.ip
  });

  return sendSuccess(res, {
    message: 'Login successful',
    data: {
      user: user.toJSON(),
      ...tokens,
      sessionId
    }
  });
}));

// @desc    Logout (revoke tokens)
// @route   POST /api/auth/token/logout
// @access  Private
router.post('/logout', authenticateEnhanced, asyncHandler(async (req, res) => {
  const { refreshToken, logoutAll = false } = req.body;

  try {
    if (logoutAll) {
      // Revoke all refresh tokens for user
      await tokenService.revokeAllUserRefreshTokens(req.user._id);
      
      // Destroy all sessions
      await sessionService.destroyUserSessions(req.user._id);
    } else {
      // Revoke specific refresh token if provided
      if (refreshToken) {
        const decoded = jwt.decode(refreshToken);
        if (decoded && decoded.jti) {
          await tokenService.revokeRefreshToken(decoded.jti);
        }
      }
      
      // Destroy current session
      if (req.sessionId) {
        await sessionService.destroySession(req.sessionId);
      }
    }

    // Blacklist current access token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.substring(7);
      await tokenService.blacklistAccessToken(accessToken);
    }

    logger.info('User logged out', {
      userId: req.user._id,
      logoutAll,
      sessionId: req.sessionId
    });

    return sendSuccess(res, {
      message: logoutAll ? 'Logged out from all devices' : 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    // Even if there's an error, return success for security
    return sendSuccess(res, {
      message: 'Logged out successfully'
    });
  }
}));

// @desc    Get active tokens
// @route   GET /api/auth/token/active
// @access  Private
router.get('/active', authenticateEnhanced, asyncHandler(async (req, res) => {
  const refreshTokens = await tokenService.getUserRefreshTokens(req.user._id);

  return sendSuccess(res, {
    message: 'Active tokens retrieved',
    data: {
      refreshTokens: refreshTokens.map(token => ({
        jti: token.jti,
        deviceInfo: token.deviceInfo,
        issuedAt: token.issuedAt,
        expiresAt: token.expiresAt,
        rotationCount: token.rotationCount,
        lastUsed: token.lastUsed,
        isCurrent: token.jti === req.user.currentTokenJti
      }))
    }
  });
}));

// @desc    Revoke specific refresh token
// @route   DELETE /api/auth/token/:jti
// @access  Private
router.delete('/:jti', authenticateEnhanced, asyncHandler(async (req, res) => {
  const { jti } = req.params;

  // Verify the token belongs to the user
  const refreshTokens = await tokenService.getUserRefreshTokens(req.user._id);
  const tokenExists = refreshTokens.find(token => token.jti === jti);

  if (!tokenExists) {
    throw new ApiError('Token not found', 404);
  }

  // Revoke the token
  await tokenService.revokeRefreshToken(jti);

  logger.info('Refresh token revoked', {
    userId: req.user._id,
    tokenId: jti
  });

  return sendSuccess(res, {
    message: 'Token revoked successfully'
  });
}));

// @desc    Revoke all refresh tokens except current
// @route   DELETE /api/auth/token/revoke-others
// @access  Private
router.delete('/revoke-others', authenticateEnhanced, asyncHandler(async (req, res) => {
  // Get current token JTI from access token
  const authHeader = req.headers.authorization;
  let currentJti = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7);
    const decoded = jwt.decode(accessToken);
    
    // Find the refresh token that matches this session
    if (decoded && decoded.sessionId) {
      const refreshTokens = await tokenService.getUserRefreshTokens(req.user._id);
      const currentToken = refreshTokens.find(token => 
        token.deviceInfo.sessionId === decoded.sessionId
      );
      if (currentToken) {
        currentJti = currentToken.jti;
      }
    }
  }

  // Revoke all except current
  const revokedCount = await tokenService.revokeAllUserRefreshTokens(req.user._id, currentJti);

  logger.info('Other refresh tokens revoked', {
    userId: req.user._id,
    revokedCount,
    keptTokenId: currentJti
  });

  return sendSuccess(res, {
    message: `${revokedCount} tokens revoked successfully`
  });
}));

// @desc    Verify token validity
// @route   POST /api/auth/token/verify
// @access  Public
router.post('/verify', [
  body('token')
    .isLength({ min: 1 })
    .withMessage('Token is required'),
  body('tokenType')
    .isIn(['access', 'refresh'])
    .withMessage('Token type must be access or refresh')
], asyncHandler(async (req, res) => {
  const { token, tokenType } = req.body;

  try {
    if (tokenType === 'access') {
      const decoded = await tokenService.validateAccessToken(token);
      return sendSuccess(res, {
        message: 'Token is valid',
        data: {
          valid: true,
          decoded: {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            exp: decoded.exp,
            iat: decoded.iat
          }
        }
      });
    } else if (tokenType === 'refresh') {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );
      
      const refreshTokenData = await tokenService.getRefreshTokenInfo(decoded.jti);
      const isValid = refreshTokenData && refreshTokenData.isActive;
      
      return sendSuccess(res, {
        message: isValid ? 'Token is valid' : 'Token is invalid',
        data: {
          valid: isValid,
          decoded: isValid ? {
            id: decoded.id,
            jti: decoded.jti,
            exp: decoded.exp,
            iat: decoded.iat
          } : null
        }
      });
    }
  } catch (error) {
    return sendSuccess(res, {
      message: 'Token is invalid',
      data: {
        valid: false,
        error: error.message
      }
    });
  }
}));

// @desc    Get token statistics (admin only)
// @route   GET /api/auth/token/stats
// @access  Private (Admin)
router.get('/stats', authenticateEnhanced, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw new ApiError('Access denied', 403);
  }

  const tokenStats = await tokenService.getTokenStats();
  const sessionStats = await sessionService.getSessionStats();

  return sendSuccess(res, {
    message: 'Token statistics retrieved',
    data: {
      tokens: tokenStats,
      sessions: sessionStats
    }
  });
}));

// @desc    Cleanup expired tokens (admin only)
// @route   POST /api/auth/token/cleanup
// @access  Private (Admin)
router.post('/cleanup', authenticateEnhanced, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw new ApiError('Access denied', 403);
  }

  const expiredTokens = await tokenService.cleanupExpiredRefreshTokens();
  const expiredSessions = await sessionService.cleanupExpiredSessions();

  logger.info('Token cleanup completed', {
    expiredTokens,
    expiredSessions: expiredSessions.expiredCount,
    adminId: req.user._id
  });

  return sendSuccess(res, {
    message: 'Cleanup completed',
    data: {
      expiredTokens,
      expiredSessions: expiredSessions.expiredCount
    }
  });
}));

export default router;









