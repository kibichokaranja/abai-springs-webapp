import fs from 'fs';
import path from 'path';
import logger from './logger.js';

class LogManager {
  constructor() {
    this.logDir = './logs';
  }

  // Get log file statistics
  async getLogStats() {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
        recentLogs: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };

      if (!fs.existsSync(this.logDir)) {
        return stats;
      }

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

        // Get recent logs from file
        const recentLogs = await this.getRecentLogs(filePath);
        stats.recentLogs.push(...recentLogs);
      }

      // Count log levels in recent logs
      stats.recentLogs.forEach(log => {
        if (log.level === 'ERROR') stats.errorCount++;
        else if (log.level === 'WARN') stats.warningCount++;
        else if (log.level === 'INFO') stats.infoCount++;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting log stats', { error: error.message });
      return null;
    }
  }

  // Get recent logs from a file
  async getRecentLogs(filePath, limit = 100) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const logs = lines.slice(-limit).map(line => {
        try {
          // Parse log line
          const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\]: (.+)$/);
          if (match) {
            return {
              timestamp: match[1],
              level: match[2],
              message: match[3]
            };
          }
          return null;
        } catch (error) {
          return null;
        }
      }).filter(log => log !== null);

      return logs;
    } catch (error) {
      logger.error('Error reading log file', { filePath, error: error.message });
      return [];
    }
  }

  // Search logs by criteria
  async searchLogs(criteria = {}) {
    try {
      const results = [];
      const files = fs.readdirSync(this.logDir);
      
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (this.matchesCriteria(line, criteria)) {
            results.push({
              file,
              line: this.parseLogLine(line)
            });
          }
        }
      }

      return results;
    } catch (error) {
      logger.error('Error searching logs', { error: error.message });
      return [];
    }
  }

  // Check if log line matches criteria
  matchesCriteria(line, criteria) {
    const log = this.parseLogLine(line);
    if (!log) return false;

    if (criteria.level && log.level !== criteria.level) return false;
    if (criteria.message && !log.message.includes(criteria.message)) return false;
    if (criteria.timestamp && !log.timestamp.includes(criteria.timestamp)) return false;
    
    return true;
  }

  // Parse log line
  parseLogLine(line) {
    try {
      const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\]: (.+)$/);
      if (match) {
        return {
          timestamp: match[1],
          level: match[2],
          message: match[3]
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Get error logs
  async getErrorLogs(limit = 50) {
    return this.searchLogs({ level: 'ERROR' }).slice(0, limit);
  }

  // Get warning logs
  async getWarningLogs(limit = 50) {
    return this.searchLogs({ level: 'WARN' }).slice(0, limit);
  }

  // Get security logs
  async getSecurityLogs(limit = 50) {
    const results = [];
    const securityFile = path.join(this.logDir, 'security-*.log');
    
    try {
      const files = fs.readdirSync(this.logDir).filter(file => file.startsWith('security-'));
      
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const logs = await this.getRecentLogs(filePath, limit);
        results.push(...logs);
      }
    } catch (error) {
      logger.error('Error reading security logs', { error: error.message });
    }

    return results.slice(0, limit);
  }

  // Get performance logs
  async getPerformanceLogs(limit = 50) {
    const results = [];
    
    try {
      const files = fs.readdirSync(this.logDir);
      
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.includes('Performance') || line.includes('Slow Database Query')) {
            const log = this.parseLogLine(line);
            if (log) {
              results.push({ file, line: log });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error reading performance logs', { error: error.message });
    }

    return results.slice(0, limit);
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

      logger.info('Log cleanup completed', {
        deletedCount,
        deletedSize: `${(deletedSize / 1024 / 1024).toFixed(2)}MB`
      });

      return { deletedCount, deletedSize };
    } catch (error) {
      logger.error('Error cleaning old logs', { error: error.message });
      throw error;
    }
  }

  // Get log analytics
  async getLogAnalytics() {
    try {
      const stats = await this.getLogStats();
      const errorLogs = await this.getErrorLogs(100);
      const warningLogs = await this.getWarningLogs(100);
      const securityLogs = await this.getSecurityLogs(50);

      const analytics = {
        overview: {
          totalFiles: stats.totalFiles,
          totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`,
          errorCount: stats.errorCount,
          warningCount: stats.warningCount,
          infoCount: stats.infoCount
        },
        fileTypes: stats.fileTypes,
        recentErrors: errorLogs.slice(0, 10),
        recentWarnings: warningLogs.slice(0, 10),
        securityEvents: securityLogs.slice(0, 10),
        trends: await this.getLogTrends()
      };

      return analytics;
    } catch (error) {
      logger.error('Error getting log analytics', { error: error.message });
      return null;
    }
  }

  // Get log trends
  async getLogTrends() {
    try {
      const trends = {
        errors: {},
        warnings: {},
        info: {}
      };

      const files = fs.readdirSync(this.logDir);
      
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          const log = this.parseLogLine(line);
          if (log) {
            const date = log.timestamp.split(' ')[0];
            
            if (log.level === 'ERROR') {
              trends.errors[date] = (trends.errors[date] || 0) + 1;
            } else if (log.level === 'WARN') {
              trends.warnings[date] = (trends.warnings[date] || 0) + 1;
            } else if (log.level === 'INFO') {
              trends.info[date] = (trends.info[date] || 0) + 1;
            }
          }
        }
      }

      return trends;
    } catch (error) {
      logger.error('Error getting log trends', { error: error.message });
      return {};
    }
  }

  // Export logs to file
  async exportLogs(criteria = {}, outputFile) {
    try {
      const logs = await this.searchLogs(criteria);
      const exportData = {
        exportDate: new Date().toISOString(),
        criteria,
        logs: logs.map(log => ({
          file: log.file,
          timestamp: log.line.timestamp,
          level: log.line.level,
          message: log.line.message
        }))
      };

      fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
      
      logger.info('Logs exported successfully', {
        outputFile,
        logCount: logs.length
      });

      return { success: true, logCount: logs.length };
    } catch (error) {
      logger.error('Error exporting logs', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Monitor log file size
  async monitorLogSize() {
    try {
      const stats = await this.getLogStats();
      const maxSize = 100 * 1024 * 1024; // 100MB
      
      if (stats.totalSize > maxSize) {
        logger.warn('Log directory size exceeded limit', {
          currentSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`,
          maxSize: `${(maxSize / 1024 / 1024).toFixed(2)}MB`
        });
        
        // Trigger cleanup
        await this.cleanOldLogs(7);
      }
    } catch (error) {
      logger.error('Error monitoring log size', { error: error.message });
    }
  }

  // Get system health from logs
  async getSystemHealth() {
    try {
      const errorLogs = await this.getErrorLogs(50);
      const warningLogs = await this.getWarningLogs(50);
      
      const health = {
        status: 'healthy',
        issues: [],
        recommendations: []
      };

      // Check for critical errors
      const criticalErrors = errorLogs.filter(log => 
        log.line.message.includes('Database') || 
        log.line.message.includes('Connection') ||
        log.line.message.includes('Authentication')
      );

      if (criticalErrors.length > 10) {
        health.status = 'critical';
        health.issues.push('High number of critical errors detected');
      } else if (criticalErrors.length > 5) {
        health.status = 'warning';
        health.issues.push('Some critical errors detected');
      }

      // Check for performance issues
      const performanceIssues = warningLogs.filter(log =>
        log.line.message.includes('Slow Database Query') ||
        log.line.message.includes('Performance Issue')
      );

      if (performanceIssues.length > 5) {
        health.status = health.status === 'critical' ? 'critical' : 'warning';
        health.issues.push('Performance issues detected');
        health.recommendations.push('Review database queries and indexes');
      }

      // Check for security issues
      const securityIssues = warningLogs.filter(log =>
        log.line.message.includes('Security Event') ||
        log.line.message.includes('Authentication Failed')
      );

      if (securityIssues.length > 10) {
        health.status = health.status === 'critical' ? 'critical' : 'warning';
        health.issues.push('Security issues detected');
        health.recommendations.push('Review authentication and security logs');
      }

      return health;
    } catch (error) {
      logger.error('Error getting system health', { error: error.message });
      return { status: 'unknown', issues: ['Unable to determine system health'] };
    }
  }
}

// Create singleton instance
const logManager = new LogManager();

export default logManager;
