import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { sendError } from '../utils/responseHandler.js';
import logger from '../utils/logger.js';

// IP whitelist for admin endpoints (optional)
const ADMIN_IP_WHITELIST = process.env.ADMIN_IP_WHITELIST 
  ? process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim())
  : [];

// IP blacklist for known malicious IPs (with timestamps for expiration)
const IP_BLACKLIST = new Map(); // Map<IP, blockedUntilTimestamp>

// Suspicious activity tracking
const suspiciousActivity = new Map();

// Production security middleware
const productionSecurity = (req, res, next) => {
  // Skip security checks for health endpoints
  if (req.url === '/health' || req.url === '/api/health') {
    return next();
  }
  
  // Get client IP - handle Railway proxy correctly
  // Railway uses X-Forwarded-For header, and Express trust proxy should handle req.ip
  // But we'll also check headers as fallback
  const forwardedFor = req.get('X-Forwarded-For');
  const clientIP = req.ip || 
                   (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
                   req.get('X-Real-IP') ||
                   req.connection?.remoteAddress ||
                   req.socket?.remoteAddress ||
                   'unknown';
  
  // Check IP blacklist (with expiration)
  const blockedUntil = IP_BLACKLIST.get(clientIP);
  if (blockedUntil && Date.now() < blockedUntil) {
    logger.logSecurity('BLACKLISTED_IP_ACCESS', {
      ip: clientIP,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    
    return sendError(res, {
      statusCode: 403,
      message: 'Access denied',
      code: 'IP_BLACKLISTED'
    });
  } else if (blockedUntil && Date.now() >= blockedUntil) {
    // Remove expired blacklist entry
    IP_BLACKLIST.delete(clientIP);
  }

  // Check for suspicious patterns
  if (isSuspiciousRequest(req)) {
    trackSuspiciousActivity(clientIP, req);
    
    // Block if too many suspicious requests (block for 1 hour)
    if (shouldBlockIP(clientIP)) {
      const blockUntil = Date.now() + (60 * 60 * 1000); // Block for 1 hour
      IP_BLACKLIST.set(clientIP, blockUntil);
      
      logger.logSecurity('IP_AUTO_BLOCKED', {
        ip: clientIP,
        reason: 'Multiple suspicious requests',
        url: req.url,
        blockedUntil: new Date(blockUntil).toISOString()
      });
      
      return sendError(res, {
        statusCode: 403,
        message: 'Access denied due to suspicious activity',
        code: 'SUSPICIOUS_ACTIVITY'
      });
    }
  }

  // Block common attack patterns
  if (hasAttackPatterns(req)) {
    logger.logSecurity('ATTACK_PATTERN_DETECTED', {
      ip: clientIP,
      url: req.url,
      userAgent: req.get('User-Agent'),
      body: req.method === 'POST' ? req.body : undefined
    });
    
    return sendError(res, {
      statusCode: 400,
      message: 'Invalid request',
      code: 'INVALID_REQUEST'
    });
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'AbaiSprings');

  next();
};

// Check for suspicious request patterns
function isSuspiciousRequest(req) {
  const suspicious = [
    // SQL injection patterns
    /(\b(union|select|insert|delete|update|drop|create|alter|exec|execute)\b)/i,
    
    // XSS patterns
    /<script|javascript:|onload=|onerror=/i,
    
    // Path traversal
    /\.\.\//,
    
    // Command injection
    /[;&|`$]/,
    
    // Common malicious user agents
    /sqlmap|nikto|nmap|masscan|zgrab/i
  ];

  const userAgent = req.get('User-Agent') || '';
  const url = req.url || '';
  const body = JSON.stringify(req.body || {});

  return suspicious.some(pattern => 
    pattern.test(url) || 
    pattern.test(userAgent) || 
    pattern.test(body)
  );
}

// Track suspicious activity per IP
function trackSuspiciousActivity(ip, req) {
  if (!suspiciousActivity.has(ip)) {
    suspiciousActivity.set(ip, []);
  }
  
  const activities = suspiciousActivity.get(ip);
  activities.push({
    timestamp: Date.now(),
    url: req.url,
    userAgent: req.get('User-Agent')
  });
  
  // Keep only last hour of activity
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  suspiciousActivity.set(ip, activities.filter(a => a.timestamp > oneHourAgo));
}

// Determine if IP should be blocked
function shouldBlockIP(ip) {
  const activities = suspiciousActivity.get(ip) || [];
  const recentActivities = activities.filter(a => 
    Date.now() - a.timestamp < (15 * 60 * 1000) // Last 15 minutes
  );
  
  // Increased threshold: 10 suspicious requests in 15 minutes (less aggressive)
  return recentActivities.length >= 10;
}

// Check for common attack patterns
function hasAttackPatterns(req) {
  const attackPatterns = [
    // WordPress/PHP specific attacks (not applicable but common)
    /wp-admin|wp-login|xmlrpc\.php|\.php$/i,
    
    // Common admin paths
    /\/admin\/|\/administrator\/|\/phpmyadmin\/|\/cpanel\//i,
    
    // Config file attempts
    /\.env|\.config|\.ini|\.conf$/i,
    
    // Backup file attempts
    /\.bak|\.backup|\.old|\.tmp$/i,
    
    // Hidden files
    /\/\.[^\/]+$/,
    
    // Common vulnerability scanners
    /\/\.well-known\/security\.txt|\/robots\.txt|\/sitemap\.xml$/i
  ];

  return attackPatterns.some(pattern => pattern.test(req.url));
}

// Admin IP restriction middleware
export const adminIPRestriction = (req, res, next) => {
  if (ADMIN_IP_WHITELIST.length === 0) {
    return next(); // No restriction if whitelist is empty
  }

  // Get client IP - handle Railway proxy correctly
  const forwardedFor = req.get('X-Forwarded-For');
  const clientIP = req.ip || 
                   (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
                   req.get('X-Real-IP') ||
                   req.connection?.remoteAddress ||
                   req.socket?.remoteAddress ||
                   'unknown';
  
  if (!ADMIN_IP_WHITELIST.includes(clientIP)) {
    logger.logSecurity('ADMIN_IP_RESTRICTION', {
      ip: clientIP,
      url: req.url,
      allowedIPs: ADMIN_IP_WHITELIST
    });
    
    return sendError(res, {
      statusCode: 403,
      message: 'Access denied: IP not authorized for admin access',
      code: 'IP_NOT_AUTHORIZED'
    });
  }
  
  next();
};

// Enhanced rate limiting for production
export const productionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Different limits based on endpoint
    if (req.url.startsWith('/api/auth')) return 5;
    if (req.url.startsWith('/api/admin')) return 10;
    if (req.url.startsWith('/api/payments')) return 3;
    return 100;
  },
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.logSecurity('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    
    return sendError(res, {
      statusCode: 429,
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

// Slow down middleware for suspicious behavior
export const productionSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // allow 10 requests per windowMs without delay
  delayMs: () => 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 5000, // maximum delay of 5 seconds
  skipSuccessfulRequests: true,
  validate: {
    delayMs: false // Disable delayMs validation warning
  }
});

// Request size limiter
export const requestSizeLimiter = (req, res, next) => {
  const maxSize = process.env.MAX_REQUEST_SIZE || '1mb';
  const contentLength = parseInt(req.get('content-length')) || 0;
  const maxBytes = maxSize === '1mb' ? 1048576 : parseInt(maxSize);
  
  if (contentLength > maxBytes) {
    logger.logSecurity('REQUEST_TOO_LARGE', {
      ip: req.ip,
      size: contentLength,
      maxSize: maxBytes,
      url: req.url
    });
    
    return sendError(res, {
      statusCode: 413,
      message: 'Request entity too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  next();
};

// File upload security
export const fileUploadSecurity = (req, res, next) => {
  if (req.files || req.file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    
    const files = req.files ? Object.values(req.files).flat() : [req.file];
    
    for (const file of files) {
      if (!allowedTypes.includes(file.mimetype)) {
        logger.logSecurity('INVALID_FILE_TYPE', {
          ip: req.ip,
          fileName: file.originalname,
          mimeType: file.mimetype
        });
        
        return sendError(res, {
          statusCode: 400,
          message: 'Invalid file type',
          code: 'INVALID_FILE_TYPE'
        });
      }
      
      if (file.size > maxFileSize) {
        logger.logSecurity('FILE_TOO_LARGE', {
          ip: req.ip,
          fileName: file.originalname,
          size: file.size
        });
        
        return sendError(res, {
          statusCode: 413,
          message: 'File too large',
          code: 'FILE_TOO_LARGE'
        });
      }
    }
  }
  
  next();
};

// Clean up old data periodically
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  // Clean suspicious activity
  for (const [ip, activities] of suspiciousActivity.entries()) {
    const recentActivities = activities.filter(a => a.timestamp > oneHourAgo);
    if (recentActivities.length === 0) {
      suspiciousActivity.delete(ip);
    } else {
      suspiciousActivity.set(ip, recentActivities);
    }
  }
  
  // Clean blacklist (remove expired entries)
  const now = Date.now();
  for (const [ip, blockedUntil] of IP_BLACKLIST.entries()) {
    if (now >= blockedUntil) {
      IP_BLACKLIST.delete(ip);
      logger.info(`Removed expired blacklist entry for IP: ${ip}`);
    }
  }
  
}, 60 * 60 * 1000); // Clean every hour

export default productionSecurity;



