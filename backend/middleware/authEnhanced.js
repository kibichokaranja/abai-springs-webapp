import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { logger } from '../utils/logger.js';

/**
 * Enhanced authentication middleware with role-based access control
 */
export const authenticateEnhanced = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate('role');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated.' 
      });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    logger.error('Enhanced authentication error', { error: error.message });
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required.' 
        });
      }

      const userRole = req.user.role;
      if (!userRole) {
        return res.status(403).json({ 
          success: false, 
          message: 'No role assigned to user.' 
        });
      }

      // Check if user has the required permission
      const hasPermission = userRole.permissions && 
        (userRole.permissions.includes(permission) || 
         userRole.permissions.includes('*')); // '*' means all permissions

      if (!hasPermission) {
        logger.warn('Permission denied', { 
          userId: req.user._id, 
          requiredPermission: permission,
          userRole: userRole.name 
        });
        
        return res.status(403).json({ 
          success: false, 
          message: `Access denied. Required permission: ${permission}` 
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error', { error: error.message });
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error during permission check.' 
      });
    }
  };
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (roleName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required.' 
        });
      }

      const userRole = req.user.role;
      if (!userRole) {
        return res.status(403).json({ 
          success: false, 
          message: 'No role assigned to user.' 
        });
      }

      // Check if user has the required role
      const hasRole = userRole.name === roleName || userRole.name === 'admin';

      if (!hasRole) {
        logger.warn('Role access denied', { 
          userId: req.user._id, 
          requiredRole: roleName,
          userRole: userRole.name 
        });
        
        return res.status(403).json({ 
          success: false, 
          message: `Access denied. Required role: ${roleName}` 
        });
      }

      next();
    } catch (error) {
      logger.error('Role check error', { error: error.message });
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error during role check.' 
      });
    }
  };
};

/**
 * Admin-only authorization middleware
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required.' 
      });
    }

    const userRole = req.user.role;
    if (!userRole || userRole.name !== 'admin') {
      logger.warn('Admin access denied', { 
        userId: req.user._id, 
        userRole: userRole?.name 
      });
      
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    next();
  } catch (error) {
    logger.error('Admin check error', { error: error.message });
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error during admin check.' 
    });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).populate('role');
        
        if (user && user.isActive) {
          req.user = user;
          req.userId = user._id;
        }
      } catch (error) {
        // Token is invalid, but we don't fail the request
        logger.debug('Invalid token in optional auth', { error: error.message });
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error', { error: error.message });
    next(); // Continue even if there's an error
  }
};

/**
 * Rate limiting based on user role
 */
export const roleBasedRateLimit = (limits) => {
  return (req, res, next) => {
    const userRole = req.user?.role?.name || 'anonymous';
    const limit = limits[userRole] || limits.default || { windowMs: 15 * 60 * 1000, max: 100 };
    
    // Simple in-memory rate limiting (in production, use Redis)
    const key = `${userRole}:${req.ip}`;
    const now = Date.now();
    
    if (!req.rateLimitStore) {
      req.rateLimitStore = new Map();
    }
    
    const userRequests = req.rateLimitStore.get(key) || [];
    const validRequests = userRequests.filter(time => now - time < limit.windowMs);
    
    if (validRequests.length >= limit.max) {
      return res.status(429).json({ 
        success: false, 
        message: 'Too many requests. Please try again later.' 
      });
    }
    
    validRequests.push(now);
    req.rateLimitStore.set(key, validRequests);
    
    next();
  };
};

