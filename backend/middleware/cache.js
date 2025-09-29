import cacheManager from '../utils/cache.js';
import logger from '../utils/logger.js';

// Cache middleware factory
export const cacheMiddleware = (type, options = {}) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if explicitly disabled
    if (req.headers['x-cache-disabled'] === 'true') {
      return next();
    }

    const {
      identifier = '',
      ttl = null,
      keyGenerator = null,
      condition = () => true
    } = options;

    try {
      // Check if caching should be skipped based on condition
      if (!condition(req)) {
        return next();
      }

      // Generate cache key
      let cacheKey;
      if (keyGenerator) {
        cacheKey = keyGenerator(req);
      } else {
        const id = identifier || req.params.id || req.query.page || 'all';
        cacheKey = cacheManager.generateKey(type, id);
      }

      // Get TTL
      const cacheTTL = ttl || cacheManager.getTTL(type);

      // Try to get from cache
      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData !== null) {
        logger.debug(`Cache middleware HIT: ${cacheKey}`);
        
        // Add cache headers
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${cacheTTL}`
        });

        return res.json(cachedData);
      }

      logger.debug(`Cache middleware MISS: ${cacheKey}`);

      // Store original send method
      const originalJson = res.json;
      const originalSend = res.send;

      // Override res.json to cache the response
      res.json = function(data) {
        // Restore original method
        res.json = originalJson;
        
        // Cache the response
        cacheManager.set(cacheKey, data, cacheTTL);
        
        // Add cache headers
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${cacheTTL}`
        });
        
        // Send the response
        return originalJson.call(this, data);
      };

      // Override res.send to cache the response
      res.send = function(data) {
        // Restore original method
        res.send = originalSend;
        
        // Only cache JSON responses
        if (typeof data === 'object') {
          cacheManager.set(cacheKey, data, cacheTTL);
        }
        
        // Add cache headers
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${cacheTTL}`
        });
        
        // Send the response
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error(`Cache middleware error:`, error);
      next();
    }
  };
};

// Cache invalidation middleware
export const invalidateCache = (type, identifier = '') => {
  return async (req, res, next) => {
    try {
      const id = identifier || req.params.id || req.body.id;
      if (id) {
        await cacheManager.invalidateByIdentifier(type, id);
        logger.debug(`Cache invalidated: ${type}:${id}`);
      } else {
        await cacheManager.invalidateByType(type);
        logger.debug(`Cache invalidated: ${type}`);
      }
      next();
    } catch (error) {
      logger.error(`Cache invalidation error:`, error);
      next();
    }
  };
};

// Cache flush middleware (admin only)
export const flushCache = async (req, res, next) => {
  try {
    await cacheManager.flush();
    logger.info('Cache flushed by admin request');
    next();
  } catch (error) {
    logger.error('Cache flush error:', error);
    next();
  }
};

// Cache statistics middleware
export const cacheStats = async (req, res, next) => {
  try {
    const stats = cacheManager.getStats();
    req.cacheStats = stats;
    next();
  } catch (error) {
    logger.error('Cache stats error:', error);
    next();
  }
};

// Cache health check middleware
export const cacheHealth = async (req, res, next) => {
  try {
    const health = await cacheManager.healthCheck();
    req.cacheHealth = health;
    next();
  } catch (error) {
    logger.error('Cache health check error:', error);
    next();
  }
};

// Predefined cache middlewares for common use cases
export const cacheProducts = cacheMiddleware('PRODUCTS');
export const cacheProduct = cacheMiddleware('PRODUCT');
export const cacheOrders = cacheMiddleware('ORDERS');
export const cacheOrder = cacheMiddleware('ORDER');
export const cacheOutlets = cacheMiddleware('OUTLETS');
export const cacheOutlet = cacheMiddleware('OUTLET');
export const cacheUsers = cacheMiddleware('USERS');
export const cacheUser = cacheMiddleware('USER');
export const cacheAnalytics = cacheMiddleware('ANALYTICS');
export const cachePayments = cacheMiddleware('PAYMENTS');

// Cache invalidation middlewares
export const invalidateProducts = invalidateCache('PRODUCTS');
export const invalidateProduct = invalidateCache('PRODUCT');
export const invalidateOrders = invalidateCache('ORDERS');
export const invalidateOrder = invalidateCache('ORDER');
export const invalidateOutlets = invalidateCache('OUTLETS');
export const invalidateOutlet = invalidateCache('OUTLET');
export const invalidateUsers = invalidateCache('USERS');
export const invalidateUser = invalidateCache('USER');
export const invalidateAnalytics = invalidateCache('ANALYTICS');
export const invalidatePayments = invalidateCache('PAYMENTS');
