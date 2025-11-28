import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Minimal server is running',
    timestamp: new Date().toISOString()
  });
});

// Database connection with timeout
console.log('🔄 Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000, // 10 seconds timeout
  connectTimeoutMS: 10000,
  socketTimeoutMS: 10000
})
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    console.log('⚠️  Server will continue without database for testing...');
  });

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`🚀 Minimal server running on port ${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}/api/health`);
});

export default app;












































