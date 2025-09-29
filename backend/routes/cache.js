import express from 'express';
import { asyncHandler } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  cacheStats,
  cacheHealth,
  flushCache,
  invalidateProducts,
  invalidateOrders,
  invalidateOutlets,
  invalidateUsers,
  invalidateAnalytics,
  invalidatePayments
} from '../middleware/cache.js';
import {
  sendSuccess,
  sendError,
  sendUnauthorized,
  sendForbidden
} from '../utils/responseHandler.js';
import cacheManager from '../utils/cache.js';

const router = express.Router();

// @desc    Base cache endpoint
// @route   GET /api/cache
// @access  Public
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Cache API',
    timestamp: new Date().toISOString(),
    endpoints: {
      stats: '/api/cache/stats',
      health: '/api/cache/health',
      flush: '/api/cache/flush',
      invalidate: '/api/cache/invalidate/:type/:id'
    },
    status: 'Cache API is running correctly'
  });
});

// Get cache statistics
router.get('/stats', cacheStats, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Cache statistics retrieved successfully',
    data: req.cacheStats
  });
}));

// Get cache health status
router.get('/health', cacheHealth, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Cache health check completed',
    data: req.cacheHealth
  });
}));

// Flush all cache (admin only)
router.delete('/flush', authenticate, authorize('admin'), flushCache, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'All cache flushed successfully',
    data: { timestamp: new Date().toISOString() }
  });
}));

// Invalidate specific cache types (admin only)
router.delete('/invalidate/products', authenticate, authorize('admin'), invalidateProducts, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Products cache invalidated successfully',
    data: { timestamp: new Date().toISOString() }
  });
}));

router.delete('/invalidate/orders', authenticate, authorize('admin'), invalidateOrders, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Orders cache invalidated successfully',
    data: { timestamp: new Date().toISOString() }
  });
}));

router.delete('/invalidate/outlets', authenticate, authorize('admin'), invalidateOutlets, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Outlets cache invalidated successfully',
    data: { timestamp: new Date().toISOString() }
  });
}));

router.delete('/invalidate/users', authenticate, authorize('admin'), invalidateUsers, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Users cache invalidated successfully',
    data: { timestamp: new Date().toISOString() }
  });
}));

router.delete('/invalidate/analytics', authenticate, authorize('admin'), invalidateAnalytics, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Analytics cache invalidated successfully',
    data: { timestamp: new Date().toISOString() }
  });
}));

router.delete('/invalidate/payments', authenticate, authorize('admin'), invalidatePayments, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Payments cache invalidated successfully',
    data: { timestamp: new Date().toISOString() }
  });
}));

// Invalidate specific cache item by ID
router.delete('/invalidate/:type/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  
  if (!type || !id) {
    return sendError(res, {
      statusCode: 400,
      message: 'Cache type and ID are required',
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }

  const success = await cacheManager.invalidateByIdentifier(type.toUpperCase(), id);
  
  if (success) {
    return sendSuccess(res, {
      message: `Cache invalidated successfully for ${type}:${id}`,
      data: { type, id, timestamp: new Date().toISOString() }
    });
  } else {
    return sendError(res, {
      statusCode: 500,
      message: 'Failed to invalidate cache',
      code: 'CACHE_INVALIDATION_ERROR'
    });
  }
}));

// Get cache keys (admin only)
router.get('/keys', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  try {
    const memoryKeys = cacheManager.memoryCache.keys();
    let redisKeys = [];
    
    if (cacheManager.redisEnabled) {
      redisKeys = await cacheManager.redis.keys('*');
    }

    return sendSuccess(res, {
      message: 'Cache keys retrieved successfully',
      data: {
        memory: memoryKeys,
        redis: redisKeys,
        total: memoryKeys.length + redisKeys.length
      }
    });
  } catch (error) {
    return sendError(res, {
      statusCode: 500,
      message: 'Failed to retrieve cache keys',
      code: 'CACHE_KEYS_ERROR'
    });
  }
}));

// Get cache configuration
router.get('/config', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Cache configuration retrieved successfully',
    data: {
      redisEnabled: cacheManager.redisEnabled,
      cacheKeys: cacheManager.cacheKeys,
      ttl: cacheManager.ttl,
      memoryConfig: {
        stdTTL: cacheManager.memoryCache.options.stdTTL,
        checkperiod: cacheManager.memoryCache.options.checkperiod,
        useClones: cacheManager.memoryCache.options.useClones,
        deleteOnExpire: cacheManager.memoryCache.options.deleteOnExpire
      }
    }
  });
}));

// Update cache TTL for a specific type
router.patch('/config/ttl/:type', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { ttl } = req.body;

  if (!ttl || typeof ttl !== 'number' || ttl < 0) {
    return sendError(res, {
      statusCode: 400,
      message: 'Valid TTL value is required',
      code: 'INVALID_TTL_VALUE'
    });
  }

  if (!cacheManager.ttl.hasOwnProperty(type.toUpperCase())) {
    return sendError(res, {
      statusCode: 400,
      message: 'Invalid cache type',
      code: 'INVALID_CACHE_TYPE'
    });
  }

  cacheManager.ttl[type.toUpperCase()] = ttl;

  return sendSuccess(res, {
    message: `TTL updated successfully for ${type}`,
    data: { type: type.toUpperCase(), ttl, timestamp: new Date().toISOString() }
  });
}));

// Cache performance test
router.post('/test', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { key, value, ttl = 60 } = req.body;

  if (!key || value === undefined) {
    return sendError(res, {
      statusCode: 400,
      message: 'Key and value are required',
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }

  const startTime = Date.now();
  
  // Test set operation
  const setSuccess = await cacheManager.set(key, value, ttl);
  const setTime = Date.now() - startTime;

  // Test get operation
  const getStartTime = Date.now();
  const retrievedValue = await cacheManager.get(key);
  const getTime = Date.now() - getStartTime;

  // Test delete operation
  const deleteStartTime = Date.now();
  const deleteSuccess = await cacheManager.del(key);
  const deleteTime = Date.now() - deleteStartTime;

  return sendSuccess(res, {
    message: 'Cache performance test completed',
    data: {
      key,
      setSuccess,
      setTime: `${setTime}ms`,
      getSuccess: retrievedValue !== null,
      getTime: `${getTime}ms`,
      deleteSuccess,
      deleteTime: `${deleteTime}ms`,
      totalTime: `${Date.now() - startTime}ms`
    }
  });
}));

export default router;
