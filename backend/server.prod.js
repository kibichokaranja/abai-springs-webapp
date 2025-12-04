import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import cluster from 'cluster';
import os from 'os';
import gracefulShutdown from 'http-graceful-shutdown';

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? './config.prod.env' : './config.env';
dotenv.config({ path: envFile });

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import outletRoutes from './routes/outlets.js';
import orderRoutes from './routes/orders.js';
import cartRoutes from './routes/cart.js';
import analyticsRoutes from './routes/analytics.js';
import paymentRoutes from './routes/payments.js';
import logRoutes from './routes/logs.js';
import cacheRoutes from './routes/cache.js';
import dashboardRoutes from './routes/dashboards.js';
import staffRoutes from './routes/staff.js';
import stockMovementRoutes from './routes/stock-movements.js';
import warehouseInventoryRoutes from './routes/warehouseInventory.js';
import driverRoutes from './routes/drivers.js';

// Import middleware
import errorHandler from './middleware/errorHandler.js';
import validate from './middleware/validate.js';
import { securityHeaders } from './middleware/auth.js';
import { requestLogger, errorLogger } from './middleware/logging.js';

// Import utilities
import logger from './utils/logger.js';
import cacheManager from './utils/cache.js';
import { globalRateLimit, apiRateLimit, adminRateLimit, getRateLimitStats } from './middleware/rateLimiting.js';

// Production Security Middleware
import productionSecurity from './middleware/productionSecurity.js';

// Clustering for production (disabled for Railway - use single worker)
if (cluster.isPrimary && process.env.NODE_ENV === 'production' && process.env.CLUSTER_WORKERS !== '0') {
  const numWorkers = process.env.CLUSTER_WORKERS === 'auto' 
    ? Math.min(os.cpus().length, 2) // Limit to max 2 workers
    : (parseInt(process.env.CLUSTER_WORKERS) || 1); // Default to 1 worker

  logger.info(`Master process ${process.pid} starting ${numWorkers} workers`);

  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    logger.info('Starting a new worker');
    cluster.fork();
  });

  // Graceful shutdown for master
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down workers');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

} else {
  // Worker process or development mode
  const app = express();

  // Trust proxy for production deployment behind reverse proxy
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Production Security Headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Compression middleware
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // CORS configuration for production
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (process.env.NODE_ENV === 'production') {
        // Always allow Railway domain requests (same-origin)
        if (origin.includes('.up.railway.app') || origin.includes('railway.app')) {
          return callback(null, true);
        }
        
        const allowedOrigins = process.env.CORS_ORIGIN 
          ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
          : ['*'];
        
        // Check if origin matches any allowed origin
        const isAllowed = allowedOrigins.some(allowed => {
          if (allowed === '*') return true;
          if (allowed === origin) return true;
          // Handle wildcard patterns like *.vercel.app
          if (allowed.includes('*')) {
            const pattern = allowed.replace(/\*/g, '.*');
            const regex = new RegExp(`^${pattern}$`);
            return regex.test(origin);
          }
          return false;
        });
        
        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        // Development: allow localhost origins
        const devOrigins = [
          'http://localhost:5500', 
          'http://127.0.0.1:5500', 
          'http://localhost:3000', 
          'http://localhost:3001', 
          'http://127.0.0.1:3001'
        ];
        if (devOrigins.includes(origin) || !origin) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-cache-disabled'],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Limit', 'X-Rate-Limit-Remaining'],
    maxAge: 86400 // 24 hours
  };
  app.use(cors(corsOptions));

  // Body parsing with security limits
  app.use(express.json({ 
    limit: process.env.NODE_ENV === 'production' ? '1mb' : '10mb',
    verify: (req, res, buf) => {
      // Store raw body for webhook verification
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: process.env.NODE_ENV === 'production' ? '1mb' : '10mb'
  }));

  // Production security middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(productionSecurity);
  }

  // Security headers
  app.use(securityHeaders);

  // Global rate limiting
  app.use(globalRateLimit);

  // Request logging
  app.use(requestLogger);

  // Validation middleware
  app.use(validate);

  // Serve static files with caching
  app.use(express.static(path.join(__dirname, '../'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      if (process.env.NODE_ENV === 'production') {
        if (path.endsWith('.js') || path.endsWith('.css')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
      }
    }
  }));

  // Health check endpoint (before other routes)
  app.get('/health', (req, res) => {
    const healthCheck = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      environment: process.env.NODE_ENV,
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      cache: cacheManager ? 'active' : 'inactive'
    };
    
    res.status(200).json(healthCheck);
  });

  // Readiness probe for Kubernetes
  app.get('/ready', async (req, res) => {
    try {
      // Check database connection
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected');
      }

      // Check cache
      const cacheHealth = await cacheManager.healthCheck();
      if (!cacheHealth.memory) {
        throw new Error('Cache not healthy');
      }

      res.status(200).json({ status: 'ready' });
    } catch (error) {
      logger.error('Readiness check failed:', error);
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });

  // Liveness probe for Kubernetes
  app.get('/live', (req, res) => {
    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
  });

  // API Routes with rate limiting
  app.use('/api/auth', authRoutes);
  app.use('/api/products', apiRateLimit, productRoutes);
  app.use('/api/outlets', apiRateLimit, outletRoutes);
  app.use('/api/orders', apiRateLimit, orderRoutes);
  app.use('/api/cart', apiRateLimit, cartRoutes);
  app.use('/api/analytics', apiRateLimit, analyticsRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/logs', adminRateLimit, logRoutes);
  app.use('/api/cache', adminRateLimit, cacheRoutes);
  app.use('/api/dashboards', dashboardRoutes);
  app.use('/api/staff', apiRateLimit, staffRoutes);
  app.use('/api/stock-movements', apiRateLimit, stockMovementRoutes);
  app.use('/api/warehouse-inventory', apiRateLimit, warehouseInventoryRoutes);
  app.use('/api/drivers', apiRateLimit, driverRoutes);

  // Rate limiting statistics
  app.get('/api/rate-limit-stats', adminRateLimit, getRateLimitStats);

  // API Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      message: 'Abai Springs API is running',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // Admin Dashboard Route (before error handlers)
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
  });

  // Staff Portal Routes
  app.get('/staff-login', (req, res) => {
    res.sendFile(path.join(__dirname, '../staff-login.html'));
  });

  // Error logging middleware
  app.use(errorLogger);

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      code: 'NOT_FOUND'
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  // Serve frontend for all other routes (SPA support)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
  });

  // Database connection with production settings
  const connectDB = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        // Production optimizations
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        
        // Additional production settings
        maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        retryWrites: true,
        w: 'majority',
        readPreference: 'primaryPreferred'
      });

      logger.info('Database connected successfully', {
        host: conn.connection.host,
        port: conn.connection.port,
        name: conn.connection.name
      });

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

    } catch (error) {
      logger.error('Database connection failed:', error);
      process.exit(1);
    }
  };

  // Start server
  const PORT = process.env.PORT || 3001;
  
  const server = app.listen(PORT, '0.0.0.0', async () => {
    logger.info('Server started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      worker: cluster.worker?.id || 'master'
    });
    
    console.log(`🚀 Abai Springs server running on port ${PORT}`);
    console.log(`📱 API available at http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend available at http://localhost:${PORT}`);
    console.log(`❤️  Health check at http://localhost:${PORT}/health`);
    
    // Connect to database after server starts
    await connectDB();
  });

  // Production server settings
  server.keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 5000;
  server.headersTimeout = parseInt(process.env.HEADERS_TIMEOUT) || 5000;

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        // Close database connection
        await mongoose.connection.close();
        logger.info('Database connection closed');
        
        // Close cache connections
        await cacheManager.close();
        logger.info('Cache connections closed');
        
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force close after timeout
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, parseInt(process.env.SHUTDOWN_TIMEOUT) || 10000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}



