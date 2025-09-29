import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

class Logger {
  constructor() {
    this.logDir = './logs';
    this.ensureLogDirectory();
    this.createLogger();
  }

  // Ensure log directory exists
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // Create Winston logger with multiple transports
  createLogger() {
    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta)}`;
        }
        
        if (stack) {
          log += `\n${stack}`;
        }
        
        return log;
      })
    );

    // Define transports
    const transports = [
      // Console transport for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
      }),

      // Daily rotate file for all logs
      new DailyRotateFile({
        filename: path.join(this.logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info'
      }),

      // Daily rotate file for error logs
      new DailyRotateFile({
        filename: path.join(this.logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error'
      }),

      // Daily rotate file for access logs
      new DailyRotateFile({
        filename: path.join(this.logDir, 'access-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info'
      }),

      // Daily rotate file for security logs
      new DailyRotateFile({
        filename: path.join(this.logDir, 'security-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '90d',
        level: 'warn'
      })
    ];

    // Create logger instance
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports,
      exitOnError: false
    });

    // Handle uncaught exceptions
    this.logger.exceptions.handle(
      new DailyRotateFile({
        filename: path.join(this.logDir, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d'
      })
    );

    // Handle unhandled promise rejections
    this.logger.rejections.handle(
      new DailyRotateFile({
        filename: path.join(this.logDir, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d'
      })
    );
  }

  // Log levels
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // Specialized logging methods
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous',
      userEmail: req.user?.email || 'anonymous'
    };

    if (res.statusCode >= 400) {
      this.warn('HTTP Request', logData);
    } else {
      this.info('HTTP Request', logData);
    }
  }

  logError(error, req = null) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    };

    if (req) {
      errorData.request = {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id || 'anonymous'
      };
    }

    this.error('Application Error', errorData);
  }

  logSecurity(event, details = {}) {
    const securityData = {
      event,
      timestamp: new Date().toISOString(),
      ...details
    };

    this.warn('Security Event', securityData);
  }

  logDatabase(query, duration, collection) {
    const dbData = {
      query,
      duration: `${duration}ms`,
      collection,
      timestamp: new Date().toISOString()
    };

    if (duration > 100) {
      this.warn('Slow Database Query', dbData);
    } else {
      this.debug('Database Query', dbData);
    }
  }

  logPayment(paymentData) {
    const paymentLog = {
      transactionId: paymentData.transactionId,
      amount: paymentData.amount,
      method: paymentData.paymentMethod,
      status: paymentData.status,
      customerId: paymentData.customer,
      timestamp: new Date().toISOString()
    };

    this.info('Payment Transaction', paymentLog);
  }

  logAuthentication(userId, action, success, details = {}) {
    const authData = {
      userId,
      action,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (success) {
      this.info('Authentication', authData);
    } else {
      this.warn('Authentication Failed', authData);
    }
  }

  logOrder(orderData) {
    const orderLog = {
      orderId: orderData._id,
      customerId: orderData.customer,
      totalAmount: orderData.totalAmount,
      status: orderData.status,
      paymentStatus: orderData.paymentStatus,
      timestamp: new Date().toISOString()
    };

    this.info('Order Created', orderLog);
  }

  logPerformance(operation, duration, details = {}) {
    const perfData = {
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (duration > 1000) {
      this.warn('Performance Issue', perfData);
    } else {
      this.debug('Performance', perfData);
    }
  }

  // Get log statistics
  async getLogStats() {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {}
      };

      const files = fs.readdirSync(this.logDir);
      
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stat = fs.statSync(filePath);
        
        stats.totalFiles++;
        stats.totalSize += stat.size;
        
        const fileType = file.split('-')[0];
        if (!stats.fileTypes[fileType]) {
          stats.fileTypes[fileType] = { count: 0, size: 0 };
        }
        stats.fileTypes[fileType].count++;
        stats.fileTypes[fileType].size += stat.size;
      }

      return stats;
    } catch (error) {
      this.error('Error getting log stats', { error: error.message });
      return null;
    }
  }

  // Clean old log files
  async cleanOldLogs(daysToKeep = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      let deletedCount = 0;
      let deletedSize = 0;

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.mtime < cutoffDate) {
          deletedSize += stat.size;
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      this.info('Log cleanup completed', {
        deletedCount,
        deletedSize: `${(deletedSize / 1024 / 1024).toFixed(2)}MB`
      });

      return { deletedCount, deletedSize };
    } catch (error) {
      this.error('Error cleaning old logs', { error: error.message });
      throw error;
    }
  }

  // Create log middleware for Express
  createMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      // Log request
      this.info('Incoming Request', {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const responseTime = Date.now() - start;
        this.logRequest(req, res, responseTime);
        originalEnd.call(this, chunk, encoding);
      }.bind(this);

      next();
    };
  }

  // Create error logging middleware
  createErrorMiddleware() {
    return (error, req, res, next) => {
      this.logError(error, req);
      next(error);
    };
  }

  // Log system metrics
  logSystemMetrics(metrics) {
    this.info('System Metrics', {
      cpu: metrics.cpu,
      memory: metrics.memory,
      uptime: metrics.uptime,
      timestamp: new Date().toISOString()
    });
  }

  // Log business metrics
  logBusinessMetrics(metrics) {
    this.info('Business Metrics', {
      activeUsers: metrics.activeUsers,
      totalOrders: metrics.totalOrders,
      revenue: metrics.revenue,
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
const logger = new Logger();

export { logger };
export default logger;
