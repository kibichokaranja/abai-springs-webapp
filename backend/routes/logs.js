import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/validate.js';
import logManager from '../utils/logManager.js';
import logger from '../utils/logger.js';
import { 
  sendSuccess, 
  sendError, 
  sendNotFound 
} from '../utils/responseHandler.js';

const router = express.Router();

// @desc    Base logs endpoint
// @route   GET /api/logs
// @access  Public
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Logs API',
    timestamp: new Date().toISOString(),
    endpoints: {
      stats: '/api/logs/stats',
      analytics: '/api/logs/analytics',
      search: '/api/logs/search',
      errors: '/api/logs/errors'
    },
    status: 'Logs API is running correctly'
  });
});

// @desc    Get log statistics
// @route   GET /api/logs/stats
// @access  Private (Admin only)
router.get('/stats',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const stats = await logManager.getLogStats();
    
    if (!stats) {
      throw new ApiError('Unable to retrieve log statistics', 500);
    }

    return sendSuccess(res, {
      message: 'Log statistics retrieved successfully',
      data: stats
    });
  })
);

// @desc    Get log analytics
// @route   GET /api/logs/analytics
// @access  Private (Admin only)
router.get('/analytics',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const analytics = await logManager.getLogAnalytics();
    
    if (!analytics) {
      throw new ApiError('Unable to retrieve log analytics', 500);
    }

    return sendSuccess(res, {
      message: 'Log analytics retrieved successfully',
      data: analytics
    });
  })
);

// @desc    Search logs
// @route   POST /api/logs/search
// @access  Private (Admin only)
router.post('/search',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { level, message, timestamp, limit = 100 } = req.body;
    
    const criteria = {};
    if (level) criteria.level = level;
    if (message) criteria.message = message;
    if (timestamp) criteria.timestamp = timestamp;

    const results = await logManager.searchLogs(criteria);
    
    return sendSuccess(res, {
      message: 'Log search completed successfully',
      data: {
        results: results.slice(0, limit),
        total: results.length,
        criteria
      }
    });
  })
);

// @desc    Get error logs
// @route   GET /api/logs/errors
// @access  Private (Admin only)
router.get('/errors',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;
    const errorLogs = await logManager.getErrorLogs(parseInt(limit));
    
    return sendSuccess(res, {
      message: 'Error logs retrieved successfully',
      data: {
        logs: errorLogs,
        count: errorLogs.length
      }
    });
  })
);

// @desc    Get warning logs
// @route   GET /api/logs/warnings
// @access  Private (Admin only)
router.get('/warnings',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;
    const warningLogs = await logManager.getWarningLogs(parseInt(limit));
    
    res.json({
      success: true,
      data: {
        logs: warningLogs,
        count: warningLogs.length
      }
    });
  })
);

// @desc    Get security logs
// @route   GET /api/logs/security
// @access  Private (Admin only)
router.get('/security',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;
    const securityLogs = await logManager.getSecurityLogs(parseInt(limit));
    
    res.json({
      success: true,
      data: {
        logs: securityLogs,
        count: securityLogs.length
      }
    });
  })
);

// @desc    Get performance logs
// @route   GET /api/logs/performance
// @access  Private (Admin only)
router.get('/performance',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;
    const performanceLogs = await logManager.getPerformanceLogs(parseInt(limit));
    
    res.json({
      success: true,
      data: {
        logs: performanceLogs,
        count: performanceLogs.length
      }
    });
  })
);

// @desc    Get system health from logs
// @route   GET /api/logs/health
// @access  Private (Admin only)
router.get('/health',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const health = await logManager.getSystemHealth();
    
    res.json({
      success: true,
      data: health
    });
  })
);

// @desc    Clean old log files
// @route   POST /api/logs/cleanup
// @access  Private (Admin only)
router.post('/cleanup',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { daysToKeep = 30 } = req.body;
    
    const result = await logManager.cleanOldLogs(daysToKeep);
    
    logger.info('Log cleanup initiated by admin', {
      adminId: req.user.id,
      daysToKeep,
      result
    });

    res.json({
      success: true,
      message: 'Log cleanup completed successfully',
      data: result
    });
  })
);

// @desc    Export logs
// @route   POST /api/logs/export
// @access  Private (Admin only)
router.post('/export',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { criteria = {}, filename = `logs-${Date.now()}.json` } = req.body;
    
    const outputFile = `./logs/exports/${filename}`;
    const result = await logManager.exportLogs(criteria, outputFile);
    
    if (!result.success) {
      throw new ApiError('Failed to export logs', 500);
    }

    logger.info('Logs exported by admin', {
      adminId: req.user.id,
      criteria,
      filename,
      logCount: result.logCount
    });

    res.json({
      success: true,
      message: 'Logs exported successfully',
      data: {
        filename,
        logCount: result.logCount,
        downloadUrl: `/api/logs/download/${filename}`
      }
    });
  })
);

// @desc    Download exported logs
// @route   GET /api/logs/download/:filename
// @access  Private (Admin only)
router.get('/download/:filename',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    const filePath = `./logs/exports/${filename}`;
    
    // Basic security check
    if (!filename.endsWith('.json')) {
      throw new ApiError('Invalid file type', 400);
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        logger.error('Error downloading log file', {
          filename,
          error: err.message
        });
        throw new ApiError('File not found', 404);
      }
    });
  })
);

// @desc    Monitor log size
// @route   POST /api/logs/monitor
// @access  Private (Admin only)
router.post('/monitor',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await logManager.monitorLogSize();
    
    res.json({
      success: true,
      message: 'Log monitoring completed'
    });
  })
);

// @desc    Get recent logs
// @route   GET /api/logs/recent
// @access  Private (Admin only)
router.get('/recent',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { limit = 100 } = req.query;
    const stats = await logManager.getLogStats();
    
    res.json({
      success: true,
      data: {
        recentLogs: stats.recentLogs.slice(0, parseInt(limit)),
        totalLogs: stats.recentLogs.length
      }
    });
  })
);

// @desc    Get log trends
// @route   GET /api/logs/trends
// @access  Private (Admin only)
router.get('/trends',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const trends = await logManager.getLogTrends();
    
    res.json({
      success: true,
      data: trends
    });
  })
);

export default router;
