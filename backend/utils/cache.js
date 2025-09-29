import NodeCache from 'node-cache';
import Redis from 'ioredis';
import logger from './logger.js';

class CacheManager {
  constructor() {
    this.memoryCache = new NodeCache({
      stdTTL: 300, // 5 minutes default
      checkperiod: 60, // Check for expired keys every minute
      useClones: false,
      deleteOnExpire: true
    });

    // Initialize Redis if available
    this.redis = null;
    this.redisEnabled = false;
    this.initializeRedis();

    // Cache statistics
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      memorySets: 0,
      redisSets: 0,
      memoryDeletes: 0,
      redisDeletes: 0
    };

    // Cache keys for different data types
    this.cacheKeys = {
      PRODUCTS: 'products',
      PRODUCT: 'product',
      ORDERS: 'orders',
      ORDER: 'order',
      OUTLETS: 'outlets',
      OUTLET: 'outlet',
      USERS: 'users',
      USER: 'user',
      ANALYTICS: 'analytics',
      PAYMENTS: 'payments',
      CART: 'cart'
    };

    // TTL configurations (in seconds)
    this.ttl = {
      PRODUCTS: 300, // 5 minutes
      PRODUCT: 600, // 10 minutes
      ORDERS: 180, // 3 minutes
      ORDER: 300, // 5 minutes
      OUTLETS: 900, // 15 minutes
      OUTLET: 1800, // 30 minutes
      USERS: 600, // 10 minutes
      USER: 1200, // 20 minutes
      ANALYTICS: 300, // 5 minutes
      PAYMENTS: 180, // 3 minutes
      CART: 3600 // 1 hour
    };

    this.setupEventListeners();
  }

  async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
          lazyConnect: true
        });

        this.redis.on('connect', () => {
          logger.info('Redis connected successfully');
          this.redisEnabled = true;
        });

        this.redis.on('error', (err) => {
          logger.error('Redis connection error:', err);
          this.redisEnabled = false;
        });

        this.redis.on('close', () => {
          logger.warn('Redis connection closed');
          this.redisEnabled = false;
        });

        await this.redis.connect();
      } else {
        logger.info('Redis not configured, using in-memory cache only');
      }
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.redisEnabled = false;
    }
  }

  setupEventListeners() {
    // Memory cache event listeners
    this.memoryCache.on('set', (key, value) => {
      this.stats.memorySets++;
      logger.debug(`Memory cache SET: ${key}`);
    });

    this.memoryCache.on('del', (key, value) => {
      this.stats.memoryDeletes++;
      logger.debug(`Memory cache DEL: ${key}`);
    });

    this.memoryCache.on('expired', (key, value) => {
      logger.debug(`Memory cache EXPIRED: ${key}`);
    });

    this.memoryCache.on('flush', () => {
      logger.info('Memory cache flushed');
    });
  }

  // Generate cache key with prefix
  generateKey(type, identifier = '') {
    const prefix = this.cacheKeys[type] || type;
    return identifier ? `${prefix}:${identifier}` : prefix;
  }

  // Get TTL for cache type
  getTTL(type) {
    return this.ttl[type] || 300; // Default 5 minutes
  }

  // Set cache value
  async set(key, value, ttl = 300) {
    try {
      // Set in memory cache
      this.memoryCache.set(key, value, ttl);
      this.stats.memorySets++;

      // Set in Redis if available
      if (this.redisEnabled) {
        await this.redis.setex(key, ttl, JSON.stringify(value));
        this.stats.redisSets++;
      }

      logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  // Get cache value
  async get(key) {
    try {
      // Try memory cache first
      let value = this.memoryCache.get(key);
      if (value !== undefined) {
        this.stats.memoryHits++;
        logger.debug(`Memory cache HIT: ${key}`);
        return value;
      }
      this.stats.memoryMisses++;

      // Try Redis if available
      if (this.redisEnabled) {
        const redisValue = await this.redis.get(key);
        if (redisValue !== null) {
          const parsedValue = JSON.parse(redisValue);
          // Update memory cache with Redis value
          this.memoryCache.set(key, parsedValue, this.getTTL(key.split(':')[0]));
          this.stats.redisHits++;
          logger.debug(`Redis cache HIT: ${key}`);
          return parsedValue;
        }
        this.stats.redisMisses++;
      }

      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  // Delete cache value
  async del(key) {
    try {
      // Delete from memory cache
      this.memoryCache.del(key);
      this.stats.memoryDeletes++;

      // Delete from Redis if available
      if (this.redisEnabled) {
        await this.redis.del(key);
        this.stats.redisDeletes++;
      }

      logger.debug(`Cache DEL: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}:`, error);
      return false;
    }
  }

  // Delete multiple keys
  async delMultiple(keys) {
    try {
      // Delete from memory cache
      keys.forEach(key => this.memoryCache.del(key));

      // Delete from Redis if available
      if (this.redisEnabled && keys.length > 0) {
        await this.redis.del(...keys);
      }

      logger.debug(`Cache DEL MULTIPLE: ${keys.length} keys`);
      return true;
    } catch (error) {
      logger.error(`Cache DEL MULTIPLE error:`, error);
      return false;
    }
  }

  // Clear cache by pattern
  async clearPattern(pattern) {
    try {
      // Clear memory cache by pattern
      const memoryKeys = this.memoryCache.keys();
      const matchingMemoryKeys = memoryKeys.filter(key => key.includes(pattern));
      matchingMemoryKeys.forEach(key => this.memoryCache.del(key));

      // Clear Redis cache by pattern if available
      if (this.redisEnabled) {
        const redisKeys = await this.redis.keys(`*${pattern}*`);
        if (redisKeys.length > 0) {
          await this.redis.del(...redisKeys);
        }
      }

      logger.info(`Cache CLEAR PATTERN: ${pattern} (${matchingMemoryKeys.length} memory keys cleared)`);
      return true;
    } catch (error) {
      logger.error(`Cache CLEAR PATTERN error for pattern ${pattern}:`, error);
      return false;
    }
  }

  // Flush all cache
  async flush() {
    try {
      // Flush memory cache
      this.memoryCache.flushAll();

      // Flush Redis cache if available
      if (this.redisEnabled) {
        await this.redis.flushall();
      }

      logger.info('Cache FLUSH: All cache cleared');
      return true;
    } catch (error) {
      logger.error('Cache FLUSH error:', error);
      return false;
    }
  }

  // Get cache statistics
  getStats() {
    const memoryStats = this.memoryCache.getStats();
    const totalMemoryRequests = this.stats.memoryHits + this.stats.memoryMisses;
    const totalRedisRequests = this.stats.redisHits + this.stats.redisMisses;

    return {
      memory: {
        hits: this.stats.memoryHits,
        misses: this.stats.memoryMisses,
        sets: this.stats.memorySets,
        deletes: this.stats.memoryDeletes,
        hitRate: totalMemoryRequests > 0 ? (this.stats.memoryHits / totalMemoryRequests * 100).toFixed(2) : 0,
        keys: memoryStats.keys,
        ksize: memoryStats.ksize,
        vsize: memoryStats.vsize
      },
      redis: {
        enabled: this.redisEnabled,
        hits: this.stats.redisHits,
        misses: this.stats.redisMisses,
        sets: this.stats.redisSets,
        deletes: this.stats.redisDeletes,
        hitRate: totalRedisRequests > 0 ? (this.stats.redisHits / totalRedisRequests * 100).toFixed(2) : 0
      },
      total: {
        hits: this.stats.memoryHits + this.stats.redisHits,
        misses: this.stats.memoryMisses + this.stats.redisMisses,
        sets: this.stats.memorySets + this.stats.redisSets,
        deletes: this.stats.memoryDeletes + this.stats.redisDeletes
      }
    };
  }

  // Health check
  async healthCheck() {
    const health = {
      memory: true,
      redis: this.redisEnabled ? false : null,
      timestamp: new Date().toISOString()
    };

    try {
      // Test memory cache
      this.memoryCache.set('health_check', 'ok', 10);
      const memoryTest = this.memoryCache.get('health_check');
      health.memory = memoryTest === 'ok';

      // Test Redis if available
      if (this.redisEnabled) {
        await this.redis.setex('health_check', 10, 'ok');
        const redisTest = await this.redis.get('health_check');
        health.redis = redisTest === 'ok';
      }
    } catch (error) {
      logger.error('Cache health check failed:', error);
      health.memory = false;
      if (this.redisEnabled) health.redis = false;
    }

    return health;
  }

  // Cache middleware for Express routes
  cacheMiddleware(type, identifier = '') {
    return async (req, res, next) => {
      const cacheKey = this.generateKey(type, identifier || req.params.id || req.query.page || 'all');
      const ttl = this.getTTL(type);

      try {
        const cachedData = await this.get(cacheKey);
        if (cachedData !== null) {
          logger.debug(`Cache middleware HIT: ${cacheKey}`);
          return res.json(cachedData);
        }

        // Store original send method
        const originalSend = res.json;
        res.json = function(data) {
          // Restore original send method
          res.json = originalSend;
          
          // Cache the response
          cacheManager.set(cacheKey, data, ttl);
          
          // Send the response
          return originalSend.call(this, data);
        };

        next();
      } catch (error) {
        logger.error(`Cache middleware error for key ${cacheKey}:`, error);
        next();
      }
    };
  }

  // Invalidate cache by type
  async invalidateByType(type) {
    const pattern = this.cacheKeys[type];
    if (pattern) {
      return await this.clearPattern(pattern);
    }
    return false;
  }

  // Invalidate cache by identifier
  async invalidateByIdentifier(type, identifier) {
    const key = this.generateKey(type, identifier);
    return await this.del(key);
  }

  // Close connections
  async close() {
    try {
      if (this.redisEnabled && this.redis) {
        await this.redis.quit();
      }
      logger.info('Cache manager closed');
    } catch (error) {
      logger.error('Error closing cache manager:', error);
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

export default cacheManager;
