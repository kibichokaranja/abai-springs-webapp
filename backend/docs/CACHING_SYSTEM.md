# Caching System Documentation

## Overview

The Abai Springs web application implements a comprehensive caching system to improve performance and reduce database load. The system supports both in-memory caching and Redis caching, with automatic fallback mechanisms.

## Architecture

### Cache Manager (`backend/utils/cache.js`)

The core caching system is built around a `CacheManager` class that provides:

- **Dual-layer caching**: In-memory cache (fast) + Redis cache (persistent)
- **Automatic fallback**: If Redis is unavailable, falls back to in-memory only
- **Configurable TTL**: Different cache durations for different data types
- **Statistics tracking**: Hit/miss rates and performance metrics
- **Health monitoring**: Cache system health checks

### Cache Middleware (`backend/middleware/cache.js`)

Express middleware for automatic caching of API responses:

- **Automatic caching**: GET requests are automatically cached
- **Cache invalidation**: POST/PUT/DELETE requests invalidate related cache
- **Custom TTL**: Configurable cache duration per route
- **Conditional caching**: Skip caching based on custom conditions

## Cache Configuration

### TTL (Time To Live) Settings

```javascript
const ttl = {
  PRODUCTS: 300,    // 5 minutes
  PRODUCT: 600,     // 10 minutes
  ORDERS: 180,      // 3 minutes
  ORDER: 300,       // 5 minutes
  OUTLETS: 900,     // 15 minutes
  OUTLET: 1800,     // 30 minutes
  USERS: 600,       // 10 minutes
  USER: 1200,       // 20 minutes
  ANALYTICS: 300,   // 5 minutes
  PAYMENTS: 180,    // 3 minutes
  CART: 3600        // 1 hour
};
```

### Cache Keys

```javascript
const cacheKeys = {
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
```

## Usage

### Automatic Caching

Routes are automatically cached using middleware:

```javascript
// Cache all products
router.get('/', cacheProducts, asyncHandler(async (req, res) => {
  // Response is automatically cached
}));

// Cache single product
router.get('/:id', cacheProduct, asyncHandler(async (req, res) => {
  // Response is automatically cached
}));
```

### Cache Invalidation

Cache is automatically invalidated on data changes:

```javascript
// Invalidate products cache on create/update/delete
router.post('/', invalidateProducts, asyncHandler(async (req, res) => {
  // Cache is invalidated before processing
}));

router.put('/:id', invalidateProduct, asyncHandler(async (req, res) => {
  // Cache is invalidated before processing
}));
```

### Manual Cache Operations

```javascript
import cacheManager from '../utils/cache.js';

// Set cache
await cacheManager.set('key', value, ttl);

// Get cache
const value = await cacheManager.get('key');

// Delete cache
await cacheManager.del('key');

// Clear cache by pattern
await cacheManager.clearPattern('products');

// Flush all cache
await cacheManager.flush();
```

## API Endpoints

### Cache Management (`/api/cache`)

#### Get Cache Statistics
```
GET /api/cache/stats
```
Returns cache performance metrics including hit rates, memory usage, and Redis status.

#### Get Cache Health
```
GET /api/cache/health
```
Returns cache system health status for both memory and Redis.

#### Flush All Cache (Admin Only)
```
DELETE /api/cache/flush
```
Clears all cached data. Requires admin authentication.

#### Invalidate Cache by Type (Admin Only)
```
DELETE /api/cache/invalidate/products
DELETE /api/cache/invalidate/orders
DELETE /api/cache/invalidate/outlets
DELETE /api/cache/invalidate/users
DELETE /api/cache/invalidate/analytics
DELETE /api/cache/invalidate/payments
```
Invalidates all cache entries for a specific data type.

#### Invalidate Specific Cache Item (Admin Only)
```
DELETE /api/cache/invalidate/:type/:id
```
Invalidates cache for a specific item (e.g., `/api/cache/invalidate/product/123`).

#### Get Cache Keys (Admin Only)
```
GET /api/cache/keys
```
Returns all cached keys for both memory and Redis.

#### Get Cache Configuration (Admin Only)
```
GET /api/cache/config
```
Returns current cache configuration including TTL settings and Redis status.

#### Update Cache TTL (Admin Only)
```
PATCH /api/cache/config/ttl/:type
Body: { "ttl": 600 }
```
Updates TTL for a specific cache type.

#### Cache Performance Test (Admin Only)
```
POST /api/cache/test
Body: { "key": "test", "value": "data", "ttl": 60 }
```
Tests cache performance with set/get/delete operations.

## Environment Variables

### Redis Configuration (Optional)

```env
# Redis connection URL (optional)
REDIS_URL=redis://localhost:6379

# Cache configuration
CACHE_ENABLED=true
CACHE_MEMORY_TTL=300
CACHE_REDIS_TTL=600
```

## Performance Benefits

### Response Time Improvement

- **First request**: Database query (e.g., 50ms)
- **Cached request**: Memory cache (e.g., 2ms)
- **Improvement**: 96% faster response time

### Database Load Reduction

- **Without cache**: Every request hits database
- **With cache**: Only cache misses hit database
- **Typical hit rate**: 80-90% for read-heavy operations

### Memory Usage

- **In-memory cache**: Fast but limited by RAM
- **Redis cache**: Persistent across server restarts
- **Automatic cleanup**: Expired entries are automatically removed

## Monitoring and Debugging

### Cache Headers

API responses include cache headers:

```
X-Cache: HIT/MISS
X-Cache-Key: products:all
Cache-Control: public, max-age=300
```

### Logging

Cache operations are logged with different levels:

```javascript
logger.debug('Cache SET: products:all (TTL: 300s)');
logger.debug('Cache HIT: products:all');
logger.debug('Cache MISS: products:all');
logger.info('Cache FLUSH: All cache cleared');
```

### Statistics

Cache statistics are available via API:

```json
{
  "memory": {
    "hits": 150,
    "misses": 20,
    "hitRate": "88.24",
    "keys": 45,
    "ksize": 1024,
    "vsize": 51200
  },
  "redis": {
    "enabled": true,
    "hits": 50,
    "misses": 10,
    "hitRate": "83.33"
  },
  "total": {
    "hits": 200,
    "misses": 30,
    "sets": 80,
    "deletes": 15
  }
}
```

## Best Practices

### Cache Strategy

1. **Cache frequently accessed data**: Products, outlets, analytics
2. **Short TTL for dynamic data**: Orders, payments
3. **Long TTL for static data**: Outlets, user profiles
4. **Invalidate on updates**: Always invalidate related cache on data changes

### Memory Management

1. **Monitor memory usage**: Check cache statistics regularly
2. **Set appropriate TTL**: Balance performance vs memory usage
3. **Use Redis for large datasets**: Offload memory cache to Redis
4. **Implement cache warming**: Pre-populate cache for critical data

### Error Handling

1. **Graceful degradation**: System works without cache
2. **Redis fallback**: Automatic fallback to in-memory only
3. **Health monitoring**: Regular cache health checks
4. **Error logging**: All cache errors are logged

## Troubleshooting

### Common Issues

1. **High memory usage**
   - Reduce TTL values
   - Implement cache size limits
   - Use Redis for large datasets

2. **Low cache hit rate**
   - Check cache invalidation logic
   - Verify cache keys are consistent
   - Monitor cache statistics

3. **Redis connection issues**
   - Check Redis server status
   - Verify connection URL
   - System falls back to in-memory only

4. **Stale data**
   - Ensure proper cache invalidation
   - Check TTL settings
   - Verify cache key generation

### Debug Commands

```bash
# Check cache statistics
curl http://localhost:3001/api/cache/stats

# Check cache health
curl http://localhost:3001/api/cache/health

# Flush cache (admin only)
curl -X DELETE http://localhost:3001/api/cache/flush \
  -H "Authorization: Bearer <admin-token>"

# Test cache performance
curl -X POST http://localhost:3001/api/cache/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"key": "test", "value": "data", "ttl": 60}'
```

## Future Enhancements

1. **Cache warming**: Pre-populate cache on startup
2. **Distributed caching**: Multi-server cache coordination
3. **Cache compression**: Compress large cached objects
4. **Advanced eviction**: LRU/LFU cache eviction policies
5. **Cache analytics**: Detailed performance analytics
6. **Cache partitioning**: Separate caches for different data types
