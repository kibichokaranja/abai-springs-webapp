import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DatabaseOptimizer from '../utils/databaseOptimizer.js';

// Load environment variables
dotenv.config({ path: './config.env' });

class DatabaseOptimizationScript {
  constructor() {
    this.optimizer = new DatabaseOptimizer();
  }

  // Run full database optimization
  async runFullOptimization() {
    try {
      console.log('🚀 Starting full database optimization...\n');

      // Connect to database
      await this.connectToDatabase();

      // Create all indexes
      console.log('📊 Step 1: Creating database indexes...');
      const indexStats = await this.optimizer.createAllIndexes();
      console.log(`✅ Created ${indexStats.indexesCreated} indexes\n`);

      // Optimize queries
      console.log('⚡ Step 2: Optimizing database queries...');
      const queryOptimizations = await this.optimizer.optimizeQueries();
      console.log(`✅ Applied ${queryOptimizations.length} query optimizations\n`);

      // Clean up old data
      console.log('🧹 Step 3: Cleaning up old data...');
      const cleanupStats = await this.optimizer.cleanupOldData();
      console.log(`✅ Cleanup completed: ${cleanupStats.failedPaymentsDeleted} failed payments, ${cleanupStats.expiredTokensCleaned} expired tokens\n`);

      // Get performance stats
      console.log('📈 Step 4: Analyzing performance...');
      const performanceStats = await this.optimizer.getPerformanceStats();
      console.log('✅ Performance analysis completed\n');

      // Generate optimization report
      console.log('📋 Step 5: Generating optimization report...');
      const report = await this.optimizer.generateOptimizationReport();
      console.log('✅ Optimization report generated\n');

      // Display results
      this.displayResults(report);

      console.log('🎉 Database optimization completed successfully!');
      
      // Close database connection
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');

    } catch (error) {
      console.error('❌ Error during database optimization:', error);
      process.exit(1);
    }
  }

  // Connect to database
  async connectToDatabase() {
    try {
      console.log('🔌 Connecting to database...');
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB successfully\n');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  // Display optimization results
  displayResults(report) {
    console.log('📊 OPTIMIZATION RESULTS');
    console.log('========================\n');

    // Database stats
    console.log('📈 Database Statistics:');
    console.log(`   Collections: ${report.performance.database.collections}`);
    console.log(`   Data Size: ${this.formatBytes(report.performance.database.dataSize)}`);
    console.log(`   Index Size: ${this.formatBytes(report.performance.database.indexSize)}`);
    console.log(`   Storage Size: ${this.formatBytes(report.performance.database.storageSize)}\n`);

    // Collection stats
    console.log('📋 Collection Statistics:');
    Object.entries(report.performance.collections).forEach(([collection, stats]) => {
      console.log(`   ${collection}:`);
      console.log(`     Documents: ${stats.count}`);
      console.log(`     Size: ${this.formatBytes(stats.size)}`);
      console.log(`     Indexes: ${stats.indexes}`);
      console.log(`     Index Size: ${this.formatBytes(stats.indexSize)}\n`);
    });

    // Health status
    console.log('🏥 Database Health:');
    console.log(`   Connection: ${report.health.connection}`);
    console.log(`   Collections: ${report.health.collections.length}\n`);

    // Index information
    console.log('🔍 Index Information:');
    Object.entries(report.health.indexes).forEach(([collection, indexInfo]) => {
      if (indexInfo.error) {
        console.log(`   ${collection}: Error - ${indexInfo.error}`);
      } else {
        console.log(`   ${collection}: ${indexInfo.count} indexes`);
        console.log(`     Names: ${indexInfo.names.join(', ')}`);
      }
    });
    console.log('');

    // Recommendations
    console.log('💡 Recommendations:');
    report.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec.description} (${rec.priority} priority)`);
      console.log(`      Action: ${rec.action}`);
    });
    console.log('');
  }

  // Format bytes to human readable format
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Run specific optimization tasks
  async runSpecificTask(task) {
    try {
      await this.connectToDatabase();

      switch (task) {
        case 'indexes':
          console.log('📊 Creating database indexes...');
          await this.optimizer.createAllIndexes();
          break;
        
        case 'cleanup':
          console.log('🧹 Cleaning up old data...');
          await this.optimizer.cleanupOldData();
          break;
        
        case 'performance':
          console.log('📈 Analyzing performance...');
          const stats = await this.optimizer.getPerformanceStats();
          console.log('Performance stats:', JSON.stringify(stats, null, 2));
          break;
        
        case 'health':
          console.log('🏥 Checking database health...');
          const health = await this.optimizer.monitorDatabaseHealth();
          console.log('Health status:', JSON.stringify(health, null, 2));
          break;
        
        case 'report':
          console.log('📋 Generating optimization report...');
          const report = await this.optimizer.generateOptimizationReport();
          console.log('Optimization report:', JSON.stringify(report, null, 2));
          break;
        
        default:
          console.log('❌ Unknown task. Available tasks: indexes, cleanup, performance, health, report');
      }

      await mongoose.connection.close();
      console.log('✅ Task completed successfully');

    } catch (error) {
      console.error('❌ Error during task execution:', error);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const script = new DatabaseOptimizationScript();
  const task = process.argv[2];

  if (task) {
    // Run specific task
    await script.runSpecificTask(task);
  } else {
    // Run full optimization
    await script.runFullOptimization();
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default DatabaseOptimizationScript;
