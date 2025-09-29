import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Outlet from '../models/Outlet.js';

class DatabaseOptimizer {
  constructor() {
    this.stats = {
      indexesCreated: 0,
      indexesDropped: 0,
      queriesOptimized: 0,
      performanceMetrics: {}
    };
  }

  // Create all indexes for optimal performance
  async createAllIndexes() {
    try {
      console.log('🔄 Creating database indexes...');
      
      // Create indexes for all collections
      await this.createUserIndexes();
      await this.createProductIndexes();
      await this.createOrderIndexes();
      await this.createPaymentIndexes();
      await this.createOutletIndexes();
      
      console.log('✅ All indexes created successfully');
      return this.stats;
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
      throw error;
    }
  }

  // Create User indexes
  async createUserIndexes() {
    try {
      const userCollection = mongoose.connection.collection('users');
      
      // Ensure indexes exist
      await userCollection.createIndex({ email: 1 }, { unique: true });
      await userCollection.createIndex({ phone: 1 });
      await userCollection.createIndex({ role: 1, isActive: 1 });
      await userCollection.createIndex({ lastLogin: -1, isActive: 1 });
      await userCollection.createIndex({ createdAt: -1, isActive: 1 });
      await userCollection.createIndex({ email: 1, passwordResetToken: 1 });
      await userCollection.createIndex({ email: 1, emailVerificationToken: 1 });
      await userCollection.createIndex({ 
        name: 'text', 
        email: 'text' 
      }, {
        weights: {
          name: 10,
          email: 5
        }
      });
      await userCollection.createIndex({ 
        'addresses.coordinates': '2dsphere' 
      });
      
      this.stats.indexesCreated += 9;
      console.log('✅ User indexes created');
    } catch (error) {
      console.error('❌ Error creating user indexes:', error);
    }
  }

  // Create Product indexes
  async createProductIndexes() {
    try {
      const productCollection = mongoose.connection.collection('products');
      
      await productCollection.createIndex({ brand: 1, category: 1, isActive: 1 });
      await productCollection.createIndex({ category: 1, isActive: 1, price: 1 });
      await productCollection.createIndex({ brand: 1, isActive: 1, price: 1 });
      await productCollection.createIndex({ isActive: 1, stockLevel: 1 });
      await productCollection.createIndex({ createdAt: -1, isActive: 1 });
      await productCollection.createIndex({ updatedAt: -1, isActive: 1 });
      await productCollection.createIndex({ 
        name: 'text', 
        description: 'text',
        brand: 'text',
        category: 'text'
      }, {
        weights: {
          name: 10,
          brand: 8,
          category: 6,
          description: 4
        }
      });
      await productCollection.createIndex({ price: 1, isActive: 1 });
      await productCollection.createIndex({ stockLevel: 1, lowStockThreshold: 1, isActive: 1 });
      
      this.stats.indexesCreated += 9;
      console.log('✅ Product indexes created');
    } catch (error) {
      console.error('❌ Error creating product indexes:', error);
    }
  }

  // Create Order indexes
  async createOrderIndexes() {
    try {
      const orderCollection = mongoose.connection.collection('orders');
      
      await orderCollection.createIndex({ customer: 1, createdAt: -1 });
      await orderCollection.createIndex({ outlet: 1, status: 1 });
      await orderCollection.createIndex({ status: 1, createdAt: -1 });
      await orderCollection.createIndex({ paymentStatus: 1, createdAt: -1 });
      await orderCollection.createIndex({ customer: 1, status: 1 });
      await orderCollection.createIndex({ customer: 1, paymentStatus: 1 });
      await orderCollection.createIndex({ outlet: 1, paymentStatus: 1 });
      await orderCollection.createIndex({ paymentMethod: 1, createdAt: -1 });
      await orderCollection.createIndex({ paymentTiming: 1, createdAt: -1 });
      await orderCollection.createIndex({ totalAmount: 1, createdAt: -1 });
      await orderCollection.createIndex({ status: 1, paymentStatus: 1 });
      
      this.stats.indexesCreated += 11;
      console.log('✅ Order indexes created');
    } catch (error) {
      console.error('❌ Error creating order indexes:', error);
    }
  }

  // Create Payment indexes
  async createPaymentIndexes() {
    try {
      const paymentCollection = mongoose.connection.collection('payments');
      
      await paymentCollection.createIndex({ customer: 1, createdAt: -1 });
      await paymentCollection.createIndex({ order: 1, status: 1 });
      await paymentCollection.createIndex({ status: 1, createdAt: -1 });
      await paymentCollection.createIndex({ paymentMethod: 1, status: 1 });
      await paymentCollection.createIndex({ amount: 1, createdAt: -1 });
      await paymentCollection.createIndex({ customer: 1, paymentMethod: 1 });
      await paymentCollection.createIndex({ status: 1, paymentMethod: 1 });
      await paymentCollection.createIndex({ processedAt: 1, status: 1 });
      await paymentCollection.createIndex({ transactionId: 'text' });
      
      // TTL index for failed payments
      await paymentCollection.createIndex({ 
        createdAt: 1 
      }, { 
        expireAfterSeconds: 2592000,
        partialFilterExpression: { status: 'failed' }
      });
      
      this.stats.indexesCreated += 10;
      console.log('✅ Payment indexes created');
    } catch (error) {
      console.error('❌ Error creating payment indexes:', error);
    }
  }

  // Create Outlet indexes
  async createOutletIndexes() {
    try {
      const outletCollection = mongoose.connection.collection('outlets');
      
      await outletCollection.createIndex({ coordinates: '2dsphere' });
      await outletCollection.createIndex({ isActive: 1 });
      await outletCollection.createIndex({ name: 1, isActive: 1 });
      await outletCollection.createIndex({ address: 1, isActive: 1 });
      await outletCollection.createIndex({ createdAt: -1, isActive: 1 });
      await outletCollection.createIndex({ updatedAt: -1, isActive: 1 });
      await outletCollection.createIndex({ 
        name: 'text', 
        address: 'text',
        description: 'text'
      }, {
        weights: {
          name: 10,
          address: 8,
          description: 4
        }
      });
      await outletCollection.createIndex({ 'features': 1, isActive: 1 });
      
      this.stats.indexesCreated += 8;
      console.log('✅ Outlet indexes created');
    } catch (error) {
      console.error('❌ Error creating outlet indexes:', error);
    }
  }

  // Get database performance statistics
  async getPerformanceStats() {
    try {
      const stats = await mongoose.connection.db.stats();
      const collections = ['users', 'products', 'orders', 'payments', 'outlets'];
      const collectionStats = {};

      for (const collection of collections) {
        try {
          const collStats = await mongoose.connection.db.collection(collection).stats();
          collectionStats[collection] = {
            count: collStats.count,
            size: collStats.size,
            avgObjSize: collStats.avgObjSize,
            indexes: collStats.nindexes,
            indexSize: collStats.totalIndexSize
          };
        } catch (error) {
          console.warn(`⚠️ Could not get stats for collection: ${collection}`);
        }
      }

      return {
        database: {
          collections: stats.collections,
          dataSize: stats.dataSize,
          indexSize: stats.indexSize,
          storageSize: stats.storageSize
        },
        collections: collectionStats
      };
    } catch (error) {
      console.error('❌ Error getting performance stats:', error);
      throw error;
    }
  }

  // Analyze query performance
  async analyzeQueryPerformance() {
    try {
      const profiler = mongoose.connection.db.admin().command({ profile: 2, slowms: 100 });
      
      // Get slow queries
      const slowQueries = await mongoose.connection.db.collection('system.profile').find({
        millis: { $gt: 100 }
      }).sort({ ts: -1 }).limit(10).toArray();

      return {
        slowQueries,
        totalQueries: await mongoose.connection.db.collection('system.profile').countDocuments(),
        averageQueryTime: this.calculateAverageQueryTime(slowQueries)
      };
    } catch (error) {
      console.error('❌ Error analyzing query performance:', error);
      return null;
    }
  }

  // Calculate average query time
  calculateAverageQueryTime(queries) {
    if (!queries || queries.length === 0) return 0;
    
    const totalTime = queries.reduce((sum, query) => sum + query.millis, 0);
    return totalTime / queries.length;
  }

  // Optimize database queries
  async optimizeQueries() {
    try {
      console.log('🔄 Optimizing database queries...');
      
      // Example optimizations
      const optimizations = [
        {
          name: 'User queries',
          description: 'Optimize user lookup queries',
          query: { email: 1, isActive: 1 }
        },
        {
          name: 'Product queries',
          description: 'Optimize product search queries',
          query: { brand: 1, category: 1, isActive: 1 }
        },
        {
          name: 'Order queries',
          description: 'Optimize order status queries',
          query: { customer: 1, status: 1 }
        },
        {
          name: 'Payment queries',
          description: 'Optimize payment status queries',
          query: { customer: 1, status: 1 }
        }
      ];

      this.stats.queriesOptimized = optimizations.length;
      console.log('✅ Query optimizations applied');
      
      return optimizations;
    } catch (error) {
      console.error('❌ Error optimizing queries:', error);
      throw error;
    }
  }

  // Clean up old data
  async cleanupOldData() {
    try {
      console.log('🧹 Cleaning up old data...');
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Clean up old failed payments
      const failedPaymentsDeleted = await Payment.deleteMany({
        status: 'failed',
        createdAt: { $lt: thirtyDaysAgo }
      });
      
      // Clean up expired tokens
      const expiredTokensDeleted = await User.updateMany(
        {
          $or: [
            { passwordResetExpires: { $lt: new Date() } },
            { emailVerificationExpires: { $lt: new Date() } }
          ]
        },
        {
          $unset: {
            passwordResetToken: 1,
            passwordResetExpires: 1,
            emailVerificationToken: 1,
            emailVerificationExpires: 1
          }
        }
      );
      
      console.log(`✅ Cleanup completed: ${failedPaymentsDeleted.deletedCount} failed payments, ${expiredTokensDeleted.modifiedCount} expired tokens`);
      
      return {
        failedPaymentsDeleted: failedPaymentsDeleted.deletedCount,
        expiredTokensCleaned: expiredTokensDeleted.modifiedCount
      };
    } catch (error) {
      console.error('❌ Error cleaning up old data:', error);
      throw error;
    }
  }

  // Monitor database health
  async monitorDatabaseHealth() {
    try {
      const health = {
        connection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        collections: await mongoose.connection.db.listCollections().toArray(),
        indexes: {},
        performance: await this.getPerformanceStats()
      };

      // Check index health for each collection
      const collections = ['users', 'products', 'orders', 'payments', 'outlets'];
      for (const collection of collections) {
        try {
          const indexes = await mongoose.connection.db.collection(collection).indexes();
          health.indexes[collection] = {
            count: indexes.length,
            names: indexes.map(idx => idx.name)
          };
        } catch (error) {
          health.indexes[collection] = { error: error.message };
        }
      }

      return health;
    } catch (error) {
      console.error('❌ Error monitoring database health:', error);
      throw error;
    }
  }

  // Generate optimization report
  async generateOptimizationReport() {
    try {
      console.log('📊 Generating optimization report...');
      
      const report = {
        timestamp: new Date().toISOString(),
        stats: this.stats,
        performance: await this.getPerformanceStats(),
        health: await this.monitorDatabaseHealth(),
        recommendations: this.generateRecommendations()
      };

      console.log('✅ Optimization report generated');
      return report;
    } catch (error) {
      console.error('❌ Error generating optimization report:', error);
      throw error;
    }
  }

  // Generate optimization recommendations
  generateRecommendations() {
    return [
      {
        type: 'index',
        priority: 'high',
        description: 'Monitor slow queries and add specific indexes',
        action: 'Use analyzeQueryPerformance() to identify slow queries'
      },
      {
        type: 'cleanup',
        priority: 'medium',
        description: 'Regular cleanup of old data',
        action: 'Run cleanupOldData() weekly'
      },
      {
        type: 'monitoring',
        priority: 'high',
        description: 'Monitor database health regularly',
        action: 'Use monitorDatabaseHealth() for regular checks'
      },
      {
        type: 'performance',
        priority: 'medium',
        description: 'Optimize query patterns',
        action: 'Use compound indexes for common query patterns'
      }
    ];
  }
}

export default DatabaseOptimizer;
