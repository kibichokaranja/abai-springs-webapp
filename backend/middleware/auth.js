import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError } from './validate.js';

// Authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError('Access denied. No token provided.', 401);
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new ApiError('Access denied. No token provided.', 401);
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      throw new ApiError('User not found.', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new ApiError('Account is deactivated. Please contact support.', 401);
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.',
        details: 'Token verification failed'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired.',
        details: 'Please login again'
      });
    }

    // Handle custom ApiError
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        details: error.details || 'Authentication failed'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed.',
      details: 'Internal server error'
    });
  }
};

// Optional authentication middleware (doesn't throw error if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // Continue without user
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (user && user.isActive) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Don't throw error for optional auth, just continue
    next();
  }
};

// Role-based authorization middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        details: 'User not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied.',
        details: `Role '${req.user.role}' is not authorized to access this resource. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

// Admin authorization middleware
export const requireAdmin = (req, res, next) => {
  return authorize('admin')(req, res, next);
};

// Customer authorization middleware
export const requireCustomer = (req, res, next) => {
  return authorize('customer')(req, res, next);
};

// Resource ownership middleware
export const requireOwnership = (resourceModel, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError('Authentication required.', 401);
      }

      const resourceId = req.params[resourceIdParam];
      
      if (!resourceId) {
        throw new ApiError('Resource ID is required.', 400);
      }

      // Get the resource
      const resource = await resourceModel.findById(resourceId);
      
      if (!resource) {
        throw new ApiError('Resource not found.', 404);
      }

      // Check ownership
      const ownerField = resource.customer ? 'customer' : 'user';
      const resourceOwnerId = resource[ownerField]?.toString();
      const userId = req.user._id.toString();

      if (resourceOwnerId !== userId && req.user.role !== 'admin') {
        throw new ApiError('Access denied. You can only access your own resources.', 403);
      }

      // Add resource to request for later use
      req.resource = resource;
      next();
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          details: error.details
        });
      }

      console.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed.',
        details: 'Internal server error'
      });
    }
  };
};

// Rate limiting for authentication endpoints
export const authRateLimit = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per window
    message: {
      success: false,
      error: 'Too many login attempts. Please try again later.',
      details: 'Rate limit exceeded'
    },
    keyGenerator: (req) => {
      return `login-${req.ip}`;
    }
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registration attempts per hour
    message: {
      success: false,
      error: 'Too many registration attempts. Please try again later.',
      details: 'Rate limit exceeded'
    },
    keyGenerator: (req) => {
      return `register-${req.ip}`;
    }
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour
    message: {
      success: false,
      error: 'Too many password reset attempts. Please try again later.',
      details: 'Rate limit exceeded'
    },
    keyGenerator: (req) => {
      return `password-reset-${req.ip}`;
    }
  }
};

// Session management middleware
export const sessionCheck = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    // Check if user's session is still valid
    const user = await User.findById(req.user._id).select('lastActivity isActive');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or account deactivated.',
        details: 'Please login again'
      });
    }

    // Update last activity (optional - can be moved to a separate endpoint)
    // await User.findByIdAndUpdate(req.user._id, { lastActivity: new Date() });
    
    next();
  } catch (error) {
    console.error('Session check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Session validation failed.',
      details: 'Internal server error'
    });
  }
};

// Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (for HTTPS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content security policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' https: https://cdnjs.cloudflare.com; connect-src 'self' http://localhost:3001;");
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

// Token refresh middleware
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ApiError('Refresh token is required.', 400);
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    // Check if user exists
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      throw new ApiError('Invalid refresh token.', 401);
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token.',
        details: 'Token verification failed'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Refresh token expired.',
        details: 'Please login again'
      });
    }

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        details: error.details
      });
    }

    console.error('Token refresh error:', error);
    return res.status(500).json({
      success: false,
      error: 'Token refresh failed.',
      details: 'Internal server error'
    });
  }
};

// Logout middleware
export const logout = async (req, res, next) => {
  try {
    // In a more advanced implementation, you might want to:
    // 1. Add the token to a blacklist
    // 2. Update user's last logout time
    // 3. Clear any server-side sessions
    
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Optional: Add token to blacklist (requires Redis or database)
      // await TokenBlacklist.create({ token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      
      console.log(`User ${req.user?.email || 'unknown'} logged out`);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Logout failed.',
      details: 'Internal server error'
    });
  }
};

// Password strength validation middleware
export const validatePasswordStrength = (req, res, next) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      error: 'Password is required.',
      details: 'Password field is missing'
    });
  }

  // Password strength requirements
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Password does not meet security requirements.',
      details: errors
    });
  }

  next();
};

// Email validation middleware
export const validateEmail = (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required.',
      details: 'Email field is missing'
    });
  }

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format.',
      details: 'Please provide a valid email address'
    });
  }

  next();
};

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.trim().replace(/[<>]/g, '');
  };

  // Sanitize request body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    });
  }

  next();
};

// Authentication logging middleware
export const logAuthAttempt = (req, res, next) => {
  const authLog = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    endpoint: req.path,
    method: req.method,
    success: false // Will be updated in response
  };

  // Store auth attempt log
  console.log('Auth Attempt:', authLog);
  
  // In production, store in database
  // await AuthLog.create(authLog);

  next();
};

// Export all middleware
export default {
  authenticate,
  optionalAuth,
  authorize,
  requireAdmin,
  requireCustomer,
  requireOwnership,
  authRateLimit,
  sessionCheck,
  securityHeaders,
  refreshToken,
  logout,
  validatePasswordStrength,
  validateEmail,
  sanitizeInput,
  logAuthAttempt
}; 