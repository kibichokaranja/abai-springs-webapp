import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

console.log('Testing MongoDB connection...');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found' : 'Not found');

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected successfully!');
  
  // Test a simple query
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('📊 Available collections:', collections.map(c => c.name));
  
  await mongoose.disconnect();
  console.log('✅ Connection test completed successfully');
  
} catch (error) {
  console.error('❌ MongoDB connection failed:', error.message);
  console.error('Full error:', error);
}










