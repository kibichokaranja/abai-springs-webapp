const mongoose = require('mongoose');
const Product = require('./models/Product');
const Outlet = require('./models/Outlet');
require('dotenv').config({ path: './config.env' });

const sampleOutlets = [
  {
    name: 'Main Branch',
    address: '123 Main St, Nairobi',
    phone: '+254712345678',
    email: 'main@abaisprings.com',
    coordinates: { lat: -1.2921, lng: 36.8219 },
    deliveryZones: [
      { name: 'CBD', radius: 10, deliveryFee: 100 },
      { name: 'Westlands', radius: 15, deliveryFee: 150 }
    ],
    isActive: true
  },
  {
    name: 'Kiambu Road Outlet',
    address: 'Kiambu Rd, Nairobi',
    phone: '+254723456789',
    email: 'kiambu@abaisprings.com',
    coordinates: { lat: -1.2100, lng: 36.8800 },
    deliveryZones: [
      { name: 'Kiambu', radius: 8, deliveryFee: 120 }
    ],
    isActive: true
  }
];

const sampleProducts = [
  {
    name: '500ml',
    brand: 'Abai Springs',
    category: '500ml',
    price: 20,
    description: '500ml bottle of pure Abai Springs water.',
    image: 'images/500ml.png',
    stockLevel: 100,
    isActive: true
  },
  {
    name: '1 Litre',
    brand: 'Abai Springs',
    category: '1 Litre',
    price: 30,
    description: '1 Litre bottle of pure Abai Springs water.',
    image: 'images/1l.png',
    stockLevel: 80,
    isActive: true
  },
  {
    name: '5 Litre',
    brand: 'Abai Springs',
    category: '5 Litre',
    price: 80,
    description: '5 Litre bottle of pure Abai Springs water.',
    image: 'images/5l.png',
    stockLevel: 50,
    isActive: true
  },
  {
    name: '10 Litre',
    brand: 'Abai Springs',
    category: '10 Litre',
    price: 100,
    description: '10 Litre bottle of pure Abai Springs water.',
    image: 'images/10l.png',
    stockLevel: 30,
    isActive: true
  },
  {
    name: '20 Litre',
    brand: 'Abai Springs',
    category: '20 Litre',
    price: 150,
    description: '20 Litre bottle of pure Abai Springs water.',
    image: 'images/20l.png',
    stockLevel: 20,
    isActive: true
  },
  // Sprinkle brand
  {
    name: '500ml',
    brand: 'Sprinkle',
    category: '500ml',
    price: 20,
    description: '500ml bottle of Sprinkle water.',
    image: 'images/sprinkle-500ml.png',
    stockLevel: 100,
    isActive: true
  },
  {
    name: '1 Litre',
    brand: 'Sprinkle',
    category: '1 Litre',
    price: 30,
    description: '1 Litre bottle of Sprinkle water.',
    image: 'images/sprinkle-1l.png',
    stockLevel: 80,
    isActive: true
  },
  {
    name: '5 Litre',
    brand: 'Sprinkle',
    category: '5 Litre',
    price: 80,
    description: '5 Litre bottle of Sprinkle water.',
    image: 'images/sprinkle-5l.png',
    stockLevel: 50,
    isActive: true
  },
  {
    name: '10 Litre',
    brand: 'Sprinkle',
    category: '10 Litre',
    price: 100,
    description: '10 Litre bottle of Sprinkle water.',
    image: 'images/sprinkle-10l.png',
    stockLevel: 30,
    isActive: true
  },
  {
    name: '20 Litre',
    brand: 'Sprinkle',
    category: '20 Litre',
    price: 150,
    description: '20 Litre bottle of Sprinkle water.',
    image: 'images/sprinkle-20l.png',
    stockLevel: 20,
    isActive: true
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await Outlet.deleteMany();
    await Product.deleteMany();
    console.log('Cleared existing outlets and products');

    await Outlet.insertMany(sampleOutlets);
    await Product.insertMany(sampleProducts);
    console.log('Seeded sample outlets and products!');

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed(); 