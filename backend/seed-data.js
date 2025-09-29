import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import Outlet from './models/Outlet.js';

dotenv.config({ path: './config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB for seeding'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Sample products data
const sampleProducts = [
  {
    name: "500ml",
    brand: "Abai Springs",
    price: 20,
    description: "Perfect for on-the-go hydration",
    category: "500ml",
    stockLevel: 100,
    image: "images/500ml.png"
  },
  {
    name: "1L",
    brand: "Abai Springs",
    price: 35,
    description: "Ideal for daily hydration needs",
    category: "1 Litre",
    stockLevel: 150,
    image: "images/1l.png"
  },
  {
    name: "5L",
    brand: "Abai Springs",
    price: 150,
    description: "Perfect for families and offices",
    category: "5 Litre",
    stockLevel: 80,
    image: "images/5l.png"
  },
  {
    name: "20L",
    brand: "Abai Springs",
    price: 500,
    description: "Great for large gatherings and events",
    category: "20 Litre",
    stockLevel: 50,
    image: "images/20l.png"
  },
  // Sprinkle Products
  {
    name: "500ml",
    brand: "Sprinkle",
    price: 25,
    description: "Premium hydration with natural minerals",
    category: "500ml",
    stockLevel: 120,
    image: "images/sprinkle-500ml.png"
  },
  {
    name: "1L",
    brand: "Sprinkle",
    price: 40,
    description: "Enhanced taste with added electrolytes",
    category: "1 Litre",
    stockLevel: 180,
    image: "images/sprinkle-1l.png"
  },
  {
    name: "5L",
    brand: "Sprinkle",
    price: 180,
    description: "Family-sized premium water",
    category: "5 Litre",
    stockLevel: 90,
    image: "images/sprinkle-5l.png"
  },
  {
    name: "10L",
    brand: "Sprinkle",
    price: 350,
    description: "Large capacity for events and offices",
    category: "10 Litre",
    stockLevel: 60,
    image: "images/sprinkle-10l.png"
  },
  {
    name: "20L",
    brand: "Sprinkle",
    price: 600,
    description: "Premium water for large gatherings",
    category: "20 Litre",
    stockLevel: 40,
    image: "images/sprinkle-20l.png"
  }
];

// Sample outlets data
const sampleOutlets = [
  {
    name: "Main Branch",
    address: "123 Main Street, Nairobi",
    phone: "+254700000001",
    email: "main@abaisprings.com",
    coordinates: {
      lat: -1.2921,
      lng: 36.8219
    },
    isActive: true
  },
  {
    name: "Kiambu Road Outlet",
    address: "456 Kiambu Road, Nairobi",
    phone: "+254700000002",
    email: "kiambu@abaisprings.com",
    coordinates: {
      lat: -1.3000,
      lng: 36.8500
    },
    isActive: true
  },
  {
    name: "Westlands Outlet",
    address: "789 Westlands Road, Nairobi",
    phone: "+254700000003",
    email: "westlands@abaisprings.com",
    coordinates: {
      lat: -1.2500,
      lng: 36.8000
    },
    isActive: true
  },
  {
    name: "Karen Outlet",
    address: "321 Karen Road, Nairobi",
    phone: "+254700000004",
    email: "karen@abaisprings.com",
    coordinates: {
      lat: -1.3200,
      lng: 36.7000
    },
    isActive: true
  },
  {
    name: "Thika Road Outlet",
    address: "654 Thika Road, Nairobi",
    phone: "+254700000005",
    email: "thika@abaisprings.com",
    coordinates: {
      lat: -1.2800,
      lng: 36.9000
    },
    isActive: true
  }
];

// Seed the database
async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Clear existing data
    await Product.deleteMany({});
    await Outlet.deleteMany({});
    console.log('🗑️  Cleared existing data');
    
    // Add products
    const products = await Product.insertMany(sampleProducts);
    console.log(`✅ Added ${products.length} products`);
    
    // Add outlets
    const outlets = await Outlet.insertMany(sampleOutlets);
    console.log(`✅ Added ${outlets.length} outlets`);
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Sample data added:');
    console.log(`- Products: ${products.length}`);
    console.log(`- Outlets: ${outlets.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seeding
seedDatabase(); 