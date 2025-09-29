# Database Optimization Documentation

This document outlines the comprehensive database optimization features implemented in the Abai Springs Web App.

## 🚀 Database Optimization Features

### 1. Comprehensive Indexing Strategy
- **Single Field Indexes**: Optimized for individual field queries
- **Compound Indexes**: Multi-field indexes for complex queries
- **Text Search Indexes**: Full-text search capabilities
- **Geospatial Indexes**: Location-based queries
- **TTL Indexes**: Automatic data expiration

### 2. Performance Monitoring
- **Query Performance Analysis**: Monitor slow queries
- **Database Health Checks**: Real-time health monitoring
- **Performance Statistics**: Detailed metrics and analytics
- **Optimization Reports**: Comprehensive performance reports

### 3. Data Management
- **Automatic Cleanup**: Remove old and expired data
- **Token Management**: Automatic expiration of security tokens
- **Failed Payment Cleanup**: Remove old failed transactions
- **Storage Optimization**: Efficient data storage strategies

## 📊 Index Strategy by Collection

### User Collection Indexes
```javascript
// Single field indexes
{ email: 1 }                    // Email lookups
{ phone: 1 }                    // Phone number searches
{ role: 1 }                     // Role-based queries
{ isActive: 1 }                 // Active user queries
{ lastLogin: 1 }                // Login tracking
{ lastActivity: 1 }             // Activity monitoring
{ loginAttempts: 1 }            // Security monitoring
{ lockUntil: 1 }                // Account lock queries
{ passwordResetToken: 1 }       // Password reset lookups
{ emailVerificationToken: 1 }   // Email verification

// Compound indexes
{ email: 1, isActive: 1 }       // Email + active status
{ role: 1, isActive: 1 }        // Role + active status
{ lastLogin: -1, isActive: 1 }  // Recent logins
{ createdAt: -1, isActive: 1 }  // Recent registrations

// Text search index
{ name: 'text', email: 'text' } // Full-text search

// Geospatial index
{ 'addresses.coordinates': '2dsphere' } // Location queries

// TTL indexes
{ passwordResetExpires: 1 }     // Auto-delete after 10 minutes
{ emailVerificationExpires: 1 } // Auto-delete after 24 hours
```

### Product Collection Indexes
```javascript
// Single field indexes
{ name: 1 }                     // Product name searches
{ brand: 1 }                    // Brand-based queries
{ category: 1 }                 // Category filtering
{ price: 1 }                    // Price-based queries
{ isActive: 1 }                 // Active product queries
{ stockLevel: 1 }               // Stock monitoring

// Compound indexes
{ brand: 1, category: 1, isActive: 1 }     // Brand + category + active
{ category: 1, isActive: 1, price: 1 }     // Category + active + price
{ brand: 1, isActive: 1, price: 1 }        // Brand + active + price
{ isActive: 1, stockLevel: 1 }              // Active + stock level
{ createdAt: -1, isActive: 1 }              // Recent products
{ updatedAt: -1, isActive: 1 }              // Recently updated

// Text search index
{ 
  name: 'text', 
  description: 'text',
  brand: 'text',
  category: 'text'
}

// Price range index
{ price: 1, isActive: 1 }

// Stock monitoring index
{ stockLevel: 1, lowStockThreshold: 1, isActive: 1 }
```

### Order Collection Indexes
```javascript
// Single field indexes
{ customer: 1 }                 // Customer-based queries
{ outlet: 1 }                   // Outlet-based queries
{ status: 1 }                   // Status filtering
{ paymentStatus: 1 }            // Payment status queries
{ paymentMethod: 1 }            // Payment method analytics
{ paymentTiming: 1 }            // Payment timing analytics

// Compound indexes
{ customer: 1, createdAt: -1 }              // Customer orders by date
{ outlet: 1, status: 1 }                    // Outlet orders by status
{ status: 1, createdAt: -1 }                // Orders by status and date
{ paymentStatus: 1, createdAt: -1 }         // Payment status queries
{ customer: 1, status: 1 }                  // Customer orders by status
{ customer: 1, paymentStatus: 1 }           // Customer orders by payment
{ outlet: 1, paymentStatus: 1 }             // Outlet orders by payment
{ paymentMethod: 1, createdAt: -1 }         // Payment method analytics
{ paymentTiming: 1, createdAt: -1 }         // Payment timing analytics
{ totalAmount: 1, createdAt: -1 }           // Revenue analytics
{ status: 1, paymentStatus: 1 }             // Status + payment queries
```

### Payment Collection Indexes
```javascript
// Single field indexes
{ order: 1 }                    // Order-based queries
{ customer: 1 }                 // Customer-based queries
{ amount: 1 }                   // Amount-based queries
{ currency: 1 }                 // Currency-based queries
{ paymentMethod: 1 }            // Payment method queries
{ status: 1 }                   // Status-based queries
{ transactionId: 1 }            // Transaction ID lookups

// Compound indexes
{ customer: 1, createdAt: -1 }              // Customer payments by date
{ order: 1, status: 1 }                     // Order payments by status
{ status: 1, createdAt: -1 }                // Payments by status and date
{ paymentMethod: 1, status: 1 }             // Payment method analytics
{ amount: 1, createdAt: -1 }                // Amount-based analytics
{ customer: 1, paymentMethod: 1 }           // Customer payment methods
{ status: 1, paymentMethod: 1 }             // Status + method queries
{ processedAt: 1, status: 1 }               // Processing time analytics

// Text search index
{ transactionId: 'text' }

// TTL index for failed payments
{ createdAt: 1 }                // Auto-delete after 30 days
```

### Outlet Collection Indexes
```javascript
// Single field indexes
{ name: 1 }                     // Outlet name searches
{ address: 1 }                  // Address searches
{ phone: 1 }                    // Phone number lookups
{ email: 1 }                    // Email lookups
{ isActive: 1 }                 // Active outlet queries

// Compound indexes
{ coordinates: '2dsphere' }                  // Geospatial queries
{ name: 1, isActive: 1 }                     // Name + active status
{ address: 1, isActive: 1 }                  // Address + active status
{ createdAt: -1, isActive: 1 }               // Recent outlets
{ updatedAt: -1, isActive: 1 }               // Recently updated

// Text search index
{ 
  name: 'text', 
  address: 'text',
  description: 'text'
}

// Features index
{ 'features': 1, isActive: 1 }
```

## 🛠️ Database Optimizer Utility

### Core Features
```javascript
import DatabaseOptimizer from './utils/databaseOptimizer.js';

const optimizer = new DatabaseOptimizer();

// Create all indexes
await optimizer.createAllIndexes();

// Get performance statistics
const stats = await optimizer.getPerformanceStats();

// Analyze query performance
const analysis = await optimizer.analyzeQueryPerformance();

// Optimize queries
const optimizations = await optimizer.optimizeQueries();

// Clean up old data
const cleanup = await optimizer.cleanupOldData();

// Monitor database health
const health = await optimizer.monitorDatabaseHealth();

// Generate optimization report
const report = await optimizer.generateOptimizationReport();
```

### Performance Statistics
```javascript
const stats = await optimizer.getPerformanceStats();

// Database-level stats
{
  database: {
    collections: 5,
    dataSize: 1048576,      // 1MB
    indexSize: 524288,       // 512KB
    storageSize: 2097152     // 2MB
  },
  collections: {
    users: {
      count: 100,
      size: 204800,          // 200KB
      avgObjSize: 2048,      // 2KB
      indexes: 15,
      indexSize: 102400      // 100KB
    },
    products: {
      count: 50,
      size: 153600,          // 150KB
      avgObjSize: 3072,      // 3KB
      indexes: 12,
      indexSize: 81920       // 80KB
    }
    // ... other collections
  }
}
```

## 📋 Optimization Script

### Usage
```bash
# Run full optimization
node scripts/optimizeDatabase.js

# Run specific tasks
node scripts/optimizeDatabase.js indexes
node scripts/optimizeDatabase.js cleanup
node scripts/optimizeDatabase.js performance
node scripts/optimizeDatabase.js health
node scripts/optimizeDatabase.js report
```

### Script Features
- **Full Optimization**: Complete database optimization
- **Index Creation**: Create all necessary indexes
- **Data Cleanup**: Remove old and expired data
- **Performance Analysis**: Detailed performance metrics
- **Health Monitoring**: Database health checks
- **Report Generation**: Comprehensive optimization reports

## 🔍 Query Optimization Examples

### Optimized User Queries
```javascript
// Before optimization
const users = await User.find({ email: email, isActive: true });

// After optimization (uses compound index)
const users = await User.find({ 
  email: email, 
  isActive: true 
}).hint({ email: 1, isActive: 1 });
```

### Optimized Product Queries
```javascript
// Before optimization
const products = await Product.find({ 
  brand: 'Abai Springs', 
  category: '500ml', 
  isActive: true 
});

// After optimization (uses compound index)
const products = await Product.find({ 
  brand: 'Abai Springs', 
  category: '500ml', 
  isActive: true 
}).hint({ brand: 1, category: 1, isActive: 1 });
```

### Optimized Order Queries
```javascript
// Before optimization
const orders = await Order.find({ 
  customer: userId, 
  status: 'pending' 
});

// After optimization (uses compound index)
const orders = await Order.find({ 
  customer: userId, 
  status: 'pending' 
}).hint({ customer: 1, status: 1 });
```

## 📈 Performance Monitoring

### Query Performance Analysis
```javascript
const analysis = await optimizer.analyzeQueryPerformance();

// Results
{
  slowQueries: [
    {
      op: 'query',
      ns: 'abai_springs.users',
      query: { email: 'user@example.com' },
      millis: 150,
      ts: new Date()
    }
  ],
  totalQueries: 1000,
  averageQueryTime: 25.5
}
```

### Database Health Monitoring
```javascript
const health = await optimizer.monitorDatabaseHealth();

// Results
{
  connection: 'connected',
  collections: [
    { name: 'users', type: 'collection' },
    { name: 'products', type: 'collection' }
  ],
  indexes: {
    users: {
      count: 15,
      names: ['_id_', 'email_1', 'phone_1', ...]
    }
  },
  performance: {
    // Performance statistics
  }
}
```

## 🧹 Data Cleanup Features

### Automatic Cleanup
```javascript
const cleanup = await optimizer.cleanupOldData();

// Results
{
  failedPaymentsDeleted: 25,
  expiredTokensCleaned: 10
}
```

### Cleanup Rules
- **Failed Payments**: Auto-delete after 30 days
- **Password Reset Tokens**: Auto-expire after 10 minutes
- **Email Verification Tokens**: Auto-expire after 24 hours
- **Account Lock Tokens**: Auto-expire after 2 hours

## 📊 Optimization Report

### Report Structure
```javascript
const report = await optimizer.generateOptimizationReport();

// Report includes:
{
  timestamp: '2025-01-15T10:30:00.000Z',
  stats: {
    indexesCreated: 47,
    indexesDropped: 0,
    queriesOptimized: 4
  },
  performance: {
    // Performance statistics
  },
  health: {
    // Health status
  },
  recommendations: [
    {
      type: 'index',
      priority: 'high',
      description: 'Monitor slow queries and add specific indexes',
      action: 'Use analyzeQueryPerformance() to identify slow queries'
    }
  ]
}
```

## 🚨 Best Practices

### 1. Index Management
- **Monitor Usage**: Regularly check index usage statistics
- **Remove Unused**: Drop indexes that are not being used
- **Compound Indexes**: Use compound indexes for common query patterns
- **Covered Queries**: Design indexes to support covered queries

### 2. Query Optimization
- **Use Hints**: Use query hints for critical queries
- **Limit Results**: Always limit query results
- **Projection**: Only select needed fields
- **Aggregation**: Use aggregation pipelines for complex queries

### 3. Data Management
- **Regular Cleanup**: Schedule regular data cleanup
- **TTL Indexes**: Use TTL indexes for temporary data
- **Archiving**: Archive old data instead of deleting
- **Monitoring**: Monitor data growth and performance

### 4. Performance Monitoring
- **Slow Query Log**: Monitor slow queries
- **Index Usage**: Track index usage statistics
- **Connection Pool**: Monitor connection pool usage
- **Memory Usage**: Track memory consumption

## 🔧 Maintenance Scripts

### Weekly Maintenance
```bash
# Run weekly optimization
node scripts/optimizeDatabase.js

# Check database health
node scripts/optimizeDatabase.js health

# Generate performance report
node scripts/optimizeDatabase.js report
```

### Monthly Maintenance
```bash
# Full optimization
node scripts/optimizeDatabase.js

# Clean up old data
node scripts/optimizeDatabase.js cleanup

# Analyze performance
node scripts/optimizeDatabase.js performance
```

## 📈 Performance Metrics

### Key Performance Indicators
- **Query Response Time**: Target < 100ms for simple queries
- **Index Hit Ratio**: Target > 95%
- **Connection Pool Usage**: Target < 80%
- **Memory Usage**: Monitor for memory leaks
- **Storage Growth**: Monitor data growth rate

### Monitoring Dashboard
```javascript
const metrics = {
  queryPerformance: {
    averageResponseTime: 45,    // ms
    slowQueryCount: 5,
    indexHitRatio: 98.5        // %
  },
  databaseHealth: {
    connectionStatus: 'connected',
    activeConnections: 12,
    memoryUsage: 256           // MB
  },
  storageMetrics: {
    totalSize: 1048576,        // 1MB
    indexSize: 524288,         // 512KB
    growthRate: 1024           // 1KB/day
  }
};
```

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Maintainer**: Abai Springs Development Team
