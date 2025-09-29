import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import newsletterRoutes from './routes/newsletter.js';
import stockAlertRoutes from './routes/stockAlerts.js';
import smartStockAlertService from './services/smartStockAlertService.js';
import aiStockMonitor from './services/aiStockMonitor.js';

console.log('🚀 Starting minimal server...');

// Load environment variables
dotenv.config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add auth routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/stock-alerts', stockAlertRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Minimal server is running',
    timestamp: new Date().toISOString()
  });
});

console.log(`📡 Port: ${PORT}`);

app.listen(PORT, () => {
  console.log(`✅ Minimal server running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  
  // Initialize AI Stock Monitor
  aiStockMonitor.scheduleMonitoring();
  
  // Start Smart Stock Alert monitoring service
  smartStockAlertService.startMonitoring();
});
