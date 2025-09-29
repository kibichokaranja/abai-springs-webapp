import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import cacheManager from '../utils/cache.js';
import logger from '../utils/logger.js';

class TokenService {
  constructor() {
    this.accessTokenExpiry = process.env.JWT_EXPIRE || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRE || '7d';
    this.refreshTokenRotationThreshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  // Generate access token
  generateAccessToken(user, sessionId = null) {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      sessionId: sessionId,
      tokenType: 'access',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'abai-springs',
      audience: 'abai-springs-users'
    });
  }

  // Generate refresh token
  generateRefreshToken(user, sessionId = null) {
    const payload = {
      id: user._id,
      sessionId: sessionId,
      tokenType: 'refresh',
      jti: crypto.randomUUID(), // Unique token ID for tracking
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'abai-springs',
      audience: 'abai-springs-users'
    });
  }

  // Generate token pair with rotation
  async generateTokenPair(user, sessionId = null, deviceInfo = {}) {
    try {
      const accessToken = this.generateAccessToken(user, sessionId);
      const refreshToken = this.generateRefreshToken(user, sessionId);
      
      // Decode to get expiry times
      const accessDecoded = jwt.decode(accessToken);
      const refreshDecoded = jwt.decode(refreshToken);

      // Store refresh token info for rotation tracking
      const refreshTokenData = {
        jti: refreshDecoded.jti,
        userId: user._id.toString(),
        sessionId: sessionId,
        deviceInfo: deviceInfo,
        issuedAt: new Date(refreshDecoded.iat * 1000),
        expiresAt: new Date(refreshDecoded.exp * 1000),
        isActive: true,
        rotationCount: 0
      };

      // Store in cache with expiry
      const refreshTokenTTL = Math.floor((refreshDecoded.exp - refreshDecoded.iat));
      await cacheManager.set(`refresh_token:${refreshDecoded.jti}`, refreshTokenData, refreshTokenTTL);

      // Store in user's active refresh tokens list
      await this.addRefreshTokenToUser(user._id, refreshDecoded.jti, refreshTokenData);

      logger.info('Token pair generated', {
        userId: user._id,
        sessionId,
        tokenId: refreshDecoded.jti,
        accessTokenExp: new Date(accessDecoded.exp * 1000),
        refreshTokenExp: new Date(refreshDecoded.exp * 1000)
      });

      return {
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(accessDecoded.exp * 1000),
        refreshTokenExpiresAt: new Date(refreshDecoded.exp * 1000),
        tokenType: 'Bearer'
      };
    } catch (error) {
      logger.error('Failed to generate token pair:', error);
      throw new Error('Token generation failed');
    }
  }

  // Refresh tokens with rotation
  async refreshTokens(refreshToken, deviceInfo = {}) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        {
          issuer: 'abai-springs',
          audience: 'abai-springs-users'
        }
      );

      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token is active and not revoked
      const refreshTokenData = await cacheManager.get(`refresh_token:${decoded.jti}`);
      if (!refreshTokenData || !refreshTokenData.isActive) {
        throw new Error('Refresh token revoked or expired');
      }

      // Get user
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Check if token needs rotation
      const tokenAge = Date.now() - (decoded.iat * 1000);
      const shouldRotateRefreshToken = tokenAge > this.refreshTokenRotationThreshold;

      let newTokens;

      if (shouldRotateRefreshToken) {
        // Generate completely new token pair
        newTokens = await this.generateTokenPair(user, decoded.sessionId, deviceInfo);
        
        // Revoke old refresh token
        await this.revokeRefreshToken(decoded.jti);
        
        logger.info('Refresh token rotated', {
          userId: user._id,
          oldTokenId: decoded.jti,
          newTokenId: jwt.decode(newTokens.refreshToken).jti,
          rotationReason: 'age_threshold'
        });
      } else {
        // Just generate new access token, keep refresh token
        const newAccessToken = this.generateAccessToken(user, decoded.sessionId);
        const accessDecoded = jwt.decode(newAccessToken);

        // Update refresh token rotation count
        refreshTokenData.rotationCount += 1;
        refreshTokenData.lastUsed = new Date();
        
        const refreshTokenTTL = Math.floor((decoded.exp - Math.floor(Date.now() / 1000)));
        await cacheManager.set(`refresh_token:${decoded.jti}`, refreshTokenData, refreshTokenTTL);

        newTokens = {
          accessToken: newAccessToken,
          refreshToken: refreshToken, // Keep same refresh token
          accessTokenExpiresAt: new Date(accessDecoded.exp * 1000),
          refreshTokenExpiresAt: new Date(decoded.exp * 1000),
          tokenType: 'Bearer'
        };

        logger.info('Access token refreshed', {
          userId: user._id,
          tokenId: decoded.jti,
          rotationCount: refreshTokenData.rotationCount
        });
      }

      return newTokens;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      }
      
      logger.error('Token refresh failed:', error);
      throw new Error(error.message || 'Token refresh failed');
    }
  }

  // Revoke refresh token
  async revokeRefreshToken(jti) {
    try {
      const refreshTokenData = await cacheManager.get(`refresh_token:${jti}`);
      if (refreshTokenData) {
        refreshTokenData.isActive = false;
        refreshTokenData.revokedAt = new Date();
        
        // Update in cache
        await cacheManager.set(`refresh_token:${jti}`, refreshTokenData, 60 * 60); // Keep for 1 hour for audit
        
        // Remove from user's active tokens
        await this.removeRefreshTokenFromUser(refreshTokenData.userId, jti);
        
        logger.info('Refresh token revoked', { tokenId: jti, userId: refreshTokenData.userId });
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to revoke refresh token:', error);
      return false;
    }
  }

  // Revoke all refresh tokens for a user
  async revokeAllUserRefreshTokens(userId, exceptJti = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const refreshTokens = user.activeRefreshTokens || [];
      let revokedCount = 0;

      for (const tokenInfo of refreshTokens) {
        if (exceptJti && tokenInfo.jti === exceptJti) {
          continue; // Skip the exception token
        }
        
        const success = await this.revokeRefreshToken(tokenInfo.jti);
        if (success) {
          revokedCount++;
        }
      }

      logger.info('User refresh tokens revoked', { userId, revokedCount });
      return revokedCount;
    } catch (error) {
      logger.error('Failed to revoke user refresh tokens:', error);
      return 0;
    }
  }

  // Blacklist access token
  async blacklistAccessToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded) {
        return false;
      }

      // Calculate TTL (time until token expires)
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await cacheManager.set(`blacklist:${token}`, { revokedAt: new Date() }, ttl);
      }

      logger.info('Access token blacklisted', { 
        userId: decoded.id, 
        tokenId: decoded.jti,
        expiresIn: ttl 
      });
      return true;
    } catch (error) {
      logger.error('Failed to blacklist access token:', error);
      return false;
    }
  }

  // Check if access token is blacklisted
  async isTokenBlacklisted(token) {
    try {
      const blacklisted = await cacheManager.get(`blacklist:${token}`);
      return !!blacklisted;
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      return false;
    }
  }

  // Validate token and return payload
  async validateAccessToken(token) {
    try {
      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'abai-springs',
        audience: 'abai-springs-users'
      });

      if (decoded.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      throw error;
    }
  }

  // Get refresh token info
  async getRefreshTokenInfo(jti) {
    try {
      return await cacheManager.get(`refresh_token:${jti}`);
    } catch (error) {
      logger.error('Failed to get refresh token info:', error);
      return null;
    }
  }

  // Clean up expired refresh tokens
  async cleanupExpiredRefreshTokens() {
    try {
      const pattern = 'refresh_token:*';
      const keys = await cacheManager.getKeys(pattern);
      
      let expiredCount = 0;
      
      for (const key of keys) {
        const tokenData = await cacheManager.get(key);
        if (tokenData && new Date(tokenData.expiresAt) < new Date()) {
          await cacheManager.del(key);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        logger.info('Expired refresh tokens cleaned up', { expiredCount });
      }

      return expiredCount;
    } catch (error) {
      logger.error('Failed to cleanup expired refresh tokens:', error);
      return 0;
    }
  }

  // Get token statistics
  async getTokenStats() {
    try {
      const stats = {
        totalActiveRefreshTokens: 0,
        totalBlacklistedTokens: 0,
        tokensByDevice: {},
        averageRotationCount: 0
      };

      // Count active refresh tokens
      const refreshTokenKeys = await cacheManager.getKeys('refresh_token:*');
      let totalRotations = 0;
      let activeTokenCount = 0;

      for (const key of refreshTokenKeys) {
        const tokenData = await cacheManager.get(key);
        if (tokenData && tokenData.isActive) {
          activeTokenCount++;
          totalRotations += tokenData.rotationCount || 0;
          
          const deviceType = tokenData.deviceInfo?.deviceType || 'unknown';
          stats.tokensByDevice[deviceType] = (stats.tokensByDevice[deviceType] || 0) + 1;
        }
      }

      stats.totalActiveRefreshTokens = activeTokenCount;
      stats.averageRotationCount = activeTokenCount > 0 ? totalRotations / activeTokenCount : 0;

      // Count blacklisted tokens
      const blacklistKeys = await cacheManager.getKeys('blacklist:*');
      stats.totalBlacklistedTokens = blacklistKeys.length;

      return stats;
    } catch (error) {
      logger.error('Failed to get token stats:', error);
      return {
        totalActiveRefreshTokens: 0,
        totalBlacklistedTokens: 0,
        tokensByDevice: {},
        averageRotationCount: 0
      };
    }
  }

  // Helper methods for user token management
  async addRefreshTokenToUser(userId, jti, tokenData) {
    try {
      const user = await User.findById(userId);
      if (user) {
        if (!user.activeRefreshTokens) {
          user.activeRefreshTokens = [];
        }
        
        // Limit number of active refresh tokens per user
        const maxTokens = 10;
        if (user.activeRefreshTokens.length >= maxTokens) {
          // Remove oldest token
          const oldestToken = user.activeRefreshTokens.shift();
          await this.revokeRefreshToken(oldestToken.jti);
        }
        
        user.activeRefreshTokens.push({
          jti,
          deviceInfo: tokenData.deviceInfo,
          issuedAt: tokenData.issuedAt,
          expiresAt: tokenData.expiresAt
        });
        
        await user.save();
      }
    } catch (error) {
      logger.error('Failed to add refresh token to user:', error);
    }
  }

  async removeRefreshTokenFromUser(userId, jti) {
    try {
      const user = await User.findById(userId);
      if (user && user.activeRefreshTokens) {
        user.activeRefreshTokens = user.activeRefreshTokens.filter(token => token.jti !== jti);
        await user.save();
      }
    } catch (error) {
      logger.error('Failed to remove refresh token from user:', error);
    }
  }

  // Get user's active refresh tokens
  async getUserRefreshTokens(userId) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.activeRefreshTokens) {
        return [];
      }

      const activeTokens = [];
      
      for (const tokenInfo of user.activeRefreshTokens) {
        const fullTokenData = await this.getRefreshTokenInfo(tokenInfo.jti);
        if (fullTokenData && fullTokenData.isActive) {
          activeTokens.push({
            jti: tokenInfo.jti,
            deviceInfo: tokenInfo.deviceInfo,
            issuedAt: tokenInfo.issuedAt,
            expiresAt: tokenInfo.expiresAt,
            rotationCount: fullTokenData.rotationCount || 0,
            lastUsed: fullTokenData.lastUsed
          });
        }
      }

      return activeTokens;
    } catch (error) {
      logger.error('Failed to get user refresh tokens:', error);
      return [];
    }
  }
}

export default new TokenService();








