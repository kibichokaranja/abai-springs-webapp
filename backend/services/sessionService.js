import Redis from 'ioredis';
import crypto from 'crypto';
import User from '../models/User.js';
import logger from '../utils/logger.js';

class SessionService {
  constructor() {
    this.initializeRedis();
    this.sessionTTL = 24 * 60 * 60; // 24 hours in seconds
    this.refreshThreshold = 2 * 60 * 60; // Refresh if less than 2 hours remaining
  }

  initializeRedis() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_SESSION_DB || 1,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        lazyConnect: true,
        maxRetriesPerRequest: 3
      });

      this.redis.on('connect', () => {
        logger.info('Redis session store connected');
      });

      this.redis.on('error', (error) => {
        logger.error('Redis session store error:', error);
      });

      this.redis.on('close', () => {
        logger.warn('Redis session store connection closed');
      });

    } catch (error) {
      logger.error('Failed to initialize Redis session store:', error);
      this.redis = null;
    }
  }

  // Generate unique session ID
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create new session
  async createSession(userId, deviceInfo = {}, ttl = null) {
    try {
      const sessionId = this.generateSessionId();
      const sessionTTL = ttl || this.sessionTTL;
      
      const sessionData = {
        userId: userId.toString(),
        deviceInfo: {
          userAgent: deviceInfo.userAgent || '',
          ip: deviceInfo.ip || '',
          location: deviceInfo.location || '',
          deviceType: this.detectDeviceType(deviceInfo.userAgent),
          browser: this.detectBrowser(deviceInfo.userAgent)
        },
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        expiresAt: new Date(Date.now() + sessionTTL * 1000).toISOString(),
        isActive: true
      };

      // Store in Redis
      if (this.redis) {
        await this.redis.setex(
          `session:${sessionId}`, 
          sessionTTL, 
          JSON.stringify(sessionData)
        );

        // Add to user's active sessions list
        await this.redis.sadd(`user_sessions:${userId}`, sessionId);
        await this.redis.expire(`user_sessions:${userId}`, sessionTTL);
      }

      // Also store in MongoDB for persistence
      const user = await User.findById(userId);
      if (user) {
        user.addSession(sessionId, sessionData.deviceInfo);
        await user.save();
      }

      logger.info('Session created', { 
        userId, 
        sessionId: sessionId.substring(0, 8) + '...', 
        deviceType: sessionData.deviceInfo.deviceType 
      });

      return sessionId;
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw new Error('Session creation failed');
    }
  }

  // Get session data
  async getSession(sessionId) {
    try {
      if (!this.redis) {
        // Fallback to MongoDB if Redis is not available
        return await this.getSessionFromMongoDB(sessionId);
      }

      const sessionData = await this.redis.get(`session:${sessionId}`);
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);
      
      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        await this.destroySession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  }

  // Update session activity
  async updateSessionActivity(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      session.lastActivity = new Date().toISOString();

      // Check if session needs refresh (less than threshold remaining)
      const expiresAt = new Date(session.expiresAt);
      const now = new Date();
      const timeRemaining = (expiresAt - now) / 1000; // seconds

      if (timeRemaining < this.refreshThreshold) {
        // Extend session
        const newExpiresAt = new Date(now.getTime() + this.sessionTTL * 1000);
        session.expiresAt = newExpiresAt.toISOString();
        
        if (this.redis) {
          await this.redis.setex(
            `session:${sessionId}`, 
            this.sessionTTL, 
            JSON.stringify(session)
          );
        }

        logger.info('Session extended', { 
          sessionId: sessionId.substring(0, 8) + '...', 
          newExpiry: newExpiresAt 
        });
      } else {
        // Just update activity
        if (this.redis) {
          await this.redis.set(`session:${sessionId}`, JSON.stringify(session));
        }
      }

      // Update in MongoDB
      const user = await User.findById(session.userId);
      if (user) {
        user.updateSessionActivity(sessionId);
        await user.save();
      }

      return true;
    } catch (error) {
      logger.error('Failed to update session activity:', error);
      return false;
    }
  }

  // Destroy session
  async destroySession(sessionId) {
    try {
      // Get session to find user ID
      const session = await this.getSession(sessionId);
      
      if (this.redis) {
        // Remove from Redis
        await this.redis.del(`session:${sessionId}`);
        
        if (session) {
          // Remove from user's sessions list
          await this.redis.srem(`user_sessions:${session.userId}`, sessionId);
        }
      }

      // Remove from MongoDB
      if (session) {
        const user = await User.findById(session.userId);
        if (user) {
          user.removeSession(sessionId);
          await user.save();
        }
      }

      logger.info('Session destroyed', { 
        sessionId: sessionId.substring(0, 8) + '...',
        userId: session?.userId 
      });

      return true;
    } catch (error) {
      logger.error('Failed to destroy session:', error);
      return false;
    }
  }

  // Get all sessions for a user
  async getUserSessions(userId) {
    try {
      if (!this.redis) {
        return await this.getUserSessionsFromMongoDB(userId);
      }

      const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);
      const sessions = [];

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push({
            sessionId,
            ...session
          });
        }
      }

      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions:', error);
      return [];
    }
  }

  // Destroy all sessions for a user
  async destroyUserSessions(userId, exceptSessionId = null) {
    try {
      const sessions = await this.getUserSessions(userId);
      
      for (const session of sessions) {
        if (exceptSessionId && session.sessionId === exceptSessionId) {
          continue; // Skip the exception session
        }
        await this.destroySession(session.sessionId);
      }

      logger.info('User sessions destroyed', { 
        userId, 
        sessionsDestroyed: sessions.length - (exceptSessionId ? 1 : 0) 
      });

      return true;
    } catch (error) {
      logger.error('Failed to destroy user sessions:', error);
      return false;
    }
  }

  // Clean up expired sessions
  async cleanupExpiredSessions() {
    try {
      if (!this.redis) {
        return;
      }

      const cursor = '0';
      const pattern = 'session:*';
      const count = 100;

      let expiredCount = 0;
      let totalScanned = 0;

      const scanStream = this.redis.scanStream({
        match: pattern,
        count: count
      });

      for await (const keys of scanStream) {
        totalScanned += keys.length;

        for (const key of keys) {
          const sessionData = await this.redis.get(key);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            if (new Date(session.expiresAt) < new Date()) {
              const sessionId = key.replace('session:', '');
              await this.destroySession(sessionId);
              expiredCount++;
            }
          }
        }
      }

      if (expiredCount > 0) {
        logger.info('Expired sessions cleaned up', { 
          expiredCount, 
          totalScanned 
        });
      }

      return { expiredCount, totalScanned };
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      return { expiredCount: 0, totalScanned: 0 };
    }
  }

  // Get session statistics
  async getSessionStats() {
    try {
      const stats = {
        totalActiveSessions: 0,
        sessionsByDevice: {},
        sessionsByBrowser: {},
        averageSessionDuration: 0,
        redisStatus: this.redis ? 'connected' : 'disconnected'
      };

      if (!this.redis) {
        return stats;
      }

      // Count total active sessions
      const sessionKeys = await this.redis.keys('session:*');
      stats.totalActiveSessions = sessionKeys.length;

      // Analyze session data
      for (const key of sessionKeys.slice(0, 1000)) { // Limit for performance
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          
          // Count by device type
          const deviceType = session.deviceInfo.deviceType || 'unknown';
          stats.sessionsByDevice[deviceType] = (stats.sessionsByDevice[deviceType] || 0) + 1;
          
          // Count by browser
          const browser = session.deviceInfo.browser || 'unknown';
          stats.sessionsByBrowser[browser] = (stats.sessionsByBrowser[browser] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      return {
        totalActiveSessions: 0,
        sessionsByDevice: {},
        sessionsByBrowser: {},
        averageSessionDuration: 0,
        redisStatus: 'error'
      };
    }
  }

  // Fallback methods for MongoDB when Redis is unavailable
  async getSessionFromMongoDB(sessionId) {
    try {
      const users = await User.find({ 'activeSessions.sessionId': sessionId });
      for (const user of users) {
        const session = user.activeSessions.find(s => s.sessionId === sessionId);
        if (session && session.isActive) {
          return {
            userId: user._id.toString(),
            deviceInfo: session.deviceInfo,
            createdAt: session.createdAt.toISOString(),
            lastActivity: session.lastActivity.toISOString(),
            expiresAt: new Date(session.lastActivity.getTime() + this.sessionTTL * 1000).toISOString(),
            isActive: session.isActive
          };
        }
      }
      return null;
    } catch (error) {
      logger.error('Failed to get session from MongoDB:', error);
      return null;
    }
  }

  async getUserSessionsFromMongoDB(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];

      return user.activeSessions
        .filter(session => session.isActive)
        .map(session => ({
          sessionId: session.sessionId,
          userId: userId.toString(),
          deviceInfo: session.deviceInfo,
          createdAt: session.createdAt.toISOString(),
          lastActivity: session.lastActivity.toISOString(),
          expiresAt: new Date(session.lastActivity.getTime() + this.sessionTTL * 1000).toISOString(),
          isActive: session.isActive
        }));
    } catch (error) {
      logger.error('Failed to get user sessions from MongoDB:', error);
      return [];
    }
  }

  // Device detection helpers
  detectDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    
    userAgent = userAgent.toLowerCase();
    
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return 'mobile';
    } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  detectBrowser(userAgent) {
    if (!userAgent) return 'unknown';
    
    userAgent = userAgent.toLowerCase();
    
    if (userAgent.includes('chrome')) return 'chrome';
    if (userAgent.includes('firefox')) return 'firefox';
    if (userAgent.includes('safari')) return 'safari';
    if (userAgent.includes('edge')) return 'edge';
    if (userAgent.includes('opera')) return 'opera';
    
    return 'other';
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.redis) {
        return { status: 'disconnected', message: 'Redis not available' };
      }

      await this.redis.ping();
      return { status: 'healthy', message: 'Redis connection active' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}

export default new SessionService();









