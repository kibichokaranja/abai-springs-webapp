# Logging System Documentation

This document outlines the comprehensive logging system implemented in the Abai Springs Web App.

## 🚀 Logging System Features

### 1. Multi-Level Logging
- **Error Logs**: Critical errors and exceptions
- **Warning Logs**: Security events and performance issues
- **Info Logs**: General application events
- **Debug Logs**: Detailed debugging information

### 2. Structured Logging
- **JSON Format**: Machine-readable log entries
- **Metadata Support**: Rich context information
- **Timestamp**: Precise timing information
- **Log Levels**: Hierarchical logging levels

### 3. File Rotation
- **Daily Rotation**: Automatic daily log file rotation
- **Size Limits**: 20MB maximum file size
- **Compression**: Automatic compression of old logs
- **Retention**: Configurable retention periods

### 4. Specialized Log Files
- **Application Logs**: General application events
- **Error Logs**: Error-specific logging
- **Access Logs**: HTTP request/response logging
- **Security Logs**: Security-related events
- **Exception Logs**: Uncaught exceptions
- **Rejection Logs**: Unhandled promise rejections

## 📊 Log File Structure

### Log File Types
```
logs/
├── application-2025-01-15.log    # General application logs
├── error-2025-01-15.log          # Error-specific logs
├── access-2025-01-15.log         # HTTP request logs
├── security-2025-01-15.log       # Security events
├── exceptions-2025-01-15.log     # Uncaught exceptions
├── rejections-2025-01-15.log     # Promise rejections
└── exports/                       # Exported log files
    └── logs-1705310400000.json
```

### Log Entry Format
```javascript
// Standard log entry
{
  timestamp: '2025-01-15 10:30:00',
  level: 'INFO',
  message: 'User registered successfully',
  metadata: {
    userId: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
    ip: '192.168.1.100'
  }
}

// Error log entry
{
  timestamp: '2025-01-15 10:30:00',
  level: 'ERROR',
  message: 'Database connection failed',
  stack: 'Error: Connection timeout\n    at connect...',
  metadata: {
    errorCode: 'ECONNREFUSED',
    retryAttempt: 3
  }
}
```

## 🛠️ Logger Utility

### Basic Usage
```javascript
import logger from './utils/logger.js';

// Log levels
logger.error('Critical error occurred', { error: 'details' });
logger.warn('Warning message', { warning: 'details' });
logger.info('Information message', { info: 'details' });
logger.debug('Debug information', { debug: 'details' });
```

### Specialized Logging Methods
```javascript
// HTTP Request Logging
logger.logRequest(req, res, responseTime);

// Error Logging
logger.logError(error, req);

// Security Event Logging
logger.logSecurity('login_attempt', {
  userId: 'user123',
  ip: '192.168.1.100',
  success: false
});

// Database Query Logging
logger.logDatabase(query, duration, collection);

// Payment Transaction Logging
logger.logPayment({
  transactionId: 'TXN123456',
  amount: 1500,
  method: 'mpesa',
  status: 'completed'
});

// Authentication Logging
logger.logAuthentication('user123', 'login', true, {
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...'
});

// Order Logging
logger.logOrder({
  _id: 'order123',
  customer: 'user123',
  totalAmount: 2500,
  status: 'pending'
});

// Performance Logging
logger.logPerformance('database_query', 150, {
  collection: 'users',
  query: 'find({ email: "..." })'
});
```

## 🔧 Logging Middleware

### Request Logging Middleware
```javascript
import { requestLogger } from './middleware/logging.js';

// Apply to Express app
app.use(requestLogger);

// Logs every HTTP request with:
// - Method, URL, Status Code
// - Response Time
// - User Agent, IP Address
// - User ID (if authenticated)
```

### Error Logging Middleware
```javascript
import { errorLogger } from './middleware/logging.js';

// Apply to Express app (must be before error handler)
app.use(errorLogger);

// Logs all application errors with:
// - Error message and stack trace
// - Request details
// - User context
```

### Specialized Middleware
```javascript
import {
  databaseLogger,
  authLogger,
  paymentLogger,
  orderLogger,
  securityLogger,
  performanceLogger
} from './middleware/logging.js';

// Database query logging
databaseLogger(query, duration, collection);

// Authentication logging
authLogger(userId, action, success, details);

// Payment logging
paymentLogger(paymentData);

// Order logging
orderLogger(orderData);

// Security logging
securityLogger(event, details);

// Performance logging
performanceLogger(operation, duration, details);
```

## 📋 Log Management API

### API Endpoints
```javascript
// Get log statistics
GET /api/logs/stats

// Get log analytics
GET /api/logs/analytics

// Search logs
POST /api/logs/search
{
  "level": "ERROR",
  "message": "database",
  "timestamp": "2025-01-15",
  "limit": 100
}

// Get error logs
GET /api/logs/errors?limit=50

// Get warning logs
GET /api/logs/warnings?limit=50

// Get security logs
GET /api/logs/security?limit=50

// Get performance logs
GET /api/logs/performance?limit=50

// Get system health
GET /api/logs/health

// Clean old logs
POST /api/logs/cleanup
{
  "daysToKeep": 30
}

// Export logs
POST /api/logs/export
{
  "criteria": {
    "level": "ERROR",
    "timestamp": "2025-01-15"
  },
  "filename": "error-logs.json"
}

// Download exported logs
GET /api/logs/download/:filename

// Monitor log size
POST /api/logs/monitor

// Get recent logs
GET /api/logs/recent?limit=100

// Get log trends
GET /api/logs/trends
```

### API Response Examples
```javascript
// Log Statistics Response
{
  "success": true,
  "data": {
    "totalFiles": 15,
    "totalSize": 52428800,
    "fileTypes": {
      "application": { "count": 5, "size": 10485760 },
      "error": { "count": 3, "size": 2097152 },
      "access": { "count": 4, "size": 8388608 },
      "security": { "count": 3, "size": 4194304 }
    },
    "errorCount": 25,
    "warningCount": 15,
    "infoCount": 150
  }
}

// Log Analytics Response
{
  "success": true,
  "data": {
    "overview": {
      "totalFiles": 15,
      "totalSize": "50.0MB",
      "errorCount": 25,
      "warningCount": 15,
      "infoCount": 150
    },
    "fileTypes": {
      "application": { "count": 5, "size": "10.0MB" },
      "error": { "count": 3, "size": "2.0MB" }
    },
    "recentErrors": [
      {
        "timestamp": "2025-01-15 10:30:00",
        "level": "ERROR",
        "message": "Database connection failed"
      }
    ],
    "trends": {
      "errors": { "2025-01-15": 5, "2025-01-14": 3 },
      "warnings": { "2025-01-15": 2, "2025-01-14": 1 },
      "info": { "2025-01-15": 25, "2025-01-14": 20 }
    }
  }
}

// System Health Response
{
  "success": true,
  "data": {
    "status": "healthy",
    "issues": [],
    "recommendations": []
  }
}
```

## 🔍 Log Search and Analysis

### Search Criteria
```javascript
// Search by log level
{ "level": "ERROR" }

// Search by message content
{ "message": "database" }

// Search by timestamp
{ "timestamp": "2025-01-15" }

// Combined search
{
  "level": "ERROR",
  "message": "connection",
  "timestamp": "2025-01-15"
}
```

### Log Analytics Features
- **Error Trends**: Track error frequency over time
- **Performance Monitoring**: Identify slow operations
- **Security Analysis**: Monitor security events
- **User Activity**: Track user interactions
- **System Health**: Overall system status

## 🧹 Log Management

### Automatic Cleanup
```javascript
// Clean logs older than 30 days
await logManager.cleanOldLogs(30);

// Monitor log directory size
await logManager.monitorLogSize();

// Export logs for analysis
await logManager.exportLogs(criteria, outputFile);
```

### Log Retention Policies
- **Application Logs**: 14 days
- **Error Logs**: 30 days
- **Access Logs**: 14 days
- **Security Logs**: 90 days
- **Exception Logs**: 30 days
- **Rejection Logs**: 30 days

### File Size Limits
- **Maximum File Size**: 20MB
- **Total Directory Size**: 100MB (triggers cleanup)
- **Compression**: Automatic for old files

## 📈 Performance Monitoring

### Database Query Logging
```javascript
// Log slow queries (>100ms)
logger.logDatabase(query, duration, collection);

// Example output
{
  "timestamp": "2025-01-15 10:30:00",
  "level": "WARN",
  "message": "Slow Database Query",
  "query": "find({ email: 'user@example.com' })",
  "duration": "150ms",
  "collection": "users"
}
```

### Performance Metrics
```javascript
// Log performance issues (>1000ms)
logger.logPerformance(operation, duration, details);

// Example output
{
  "timestamp": "2025-01-15 10:30:00",
  "level": "WARN",
  "message": "Performance Issue",
  "operation": "user_registration",
  "duration": "1200ms",
  "details": {
    "steps": ["validation", "database", "email"]
  }
}
```

## 🔒 Security Logging

### Security Events
```javascript
// Log security events
logger.logSecurity(event, details);

// Event types
- 'login_attempt'
- 'password_reset'
- 'account_locked'
- 'suspicious_activity'
- 'rate_limit_exceeded'
- 'authentication_failed'
```

### Security Monitoring
```javascript
// Monitor authentication attempts
authLogger(userId, action, success, details);

// Example output
{
  "timestamp": "2025-01-15 10:30:00",
  "level": "WARN",
  "message": "Authentication Failed",
  "userId": "user123",
  "action": "login",
  "success": false,
  "ip": "192.168.1.100",
  "attempts": 3
}
```

## 🚨 Error Handling

### Uncaught Exceptions
```javascript
// Automatically logged to exceptions-*.log
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message });
  process.exit(1);
});
```

### Unhandled Promise Rejections
```javascript
// Automatically logged to rejections-*.log
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason,
    promise: promise
  });
});
```

## 🔧 Configuration

### Environment Variables
```env
# Logging Configuration
LOG_LEVEL=info                    # debug, info, warn, error
NODE_ENV=development              # development, production
LOG_DIR=./logs                   # Log directory path
LOG_MAX_SIZE=20m                 # Maximum log file size
LOG_MAX_FILES=14d                # Maximum log files to keep
```

### Winston Configuration
```javascript
// Custom Winston configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    
    // File transports
    new DailyRotateFile({
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});
```

## 📊 Monitoring and Alerts

### Log Monitoring
- **Error Rate**: Monitor error frequency
- **Response Time**: Track API response times
- **Security Events**: Monitor authentication failures
- **Performance Issues**: Identify slow operations

### Alert Thresholds
- **Error Rate**: >10% triggers alert
- **Response Time**: >1000ms triggers alert
- **Security Events**: >5 failed attempts triggers alert
- **Disk Space**: >80% usage triggers cleanup

## 🚀 Best Practices

### 1. Log Levels
- **ERROR**: System errors and exceptions
- **WARN**: Security events and performance issues
- **INFO**: General application events
- **DEBUG**: Detailed debugging information

### 2. Log Content
- **Structured Data**: Use JSON format for metadata
- **Context Information**: Include user, IP, session data
- **Error Details**: Include stack traces and error codes
- **Performance Metrics**: Include timing and resource usage

### 3. Security
- **Sensitive Data**: Never log passwords or tokens
- **PII Protection**: Anonymize personal information
- **Access Control**: Restrict log access to admins
- **Audit Trail**: Log all administrative actions

### 4. Performance
- **Async Logging**: Use non-blocking logging
- **File Rotation**: Implement automatic rotation
- **Size Limits**: Monitor log file sizes
- **Cleanup**: Regular cleanup of old logs

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Maintainer**: Abai Springs Development Team
