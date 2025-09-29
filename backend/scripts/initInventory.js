import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Outlet from '../models/Outlet.js';
import Product from '../models/Product.js';
import OutletInventory from '../models/OutletInventory.js';

// Load environment variables
dotenv.config({ path: './config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Sample outlets
const sampleOutlets = [
  {
    name: 'Kiambu Road Outlet',
    address: 'Kiambu Road, Nairobi',
    phone: '+254700123456',
    email: 'kiambu@abaisprings.com',
    coordinates: { lat: -1.2921, lng: 36.8219 },
    isActive: true
  },
  {
    name: 'Westlands Outlet',
    address: 'Westlands, Nairobi',
    phone: '+254700123457',
    email: 'westlands@abaisprings.com',
    coordinates: { lat: -1.2649, lng: 36.8065 },
    isActive: true
  },
  {
    name: 'Karen Outlet',
    address: 'Karen, Nairobi',
    phone: '+254700123458',
    email: 'karen@abaisprings.com',
    coordinates: { lat: -1.3191, lng: 36.7089 },
    isActive: true
  },
  {
    name: 'Thika Road Outlet',
    address: 'Thika Road, Nairobi',
    phone: '+254700123459',
    email: 'thika@abaisprings.com',
    coordinates: { lat: -1.2921, lng: 36.8219 },
    isActive: true
  },
  {
    name: 'Main Branch',
    address: 'CBD, Nairobi',
    phone: '+254700123460',
    email: 'main@abaisprings.com',
    coordinates: { lat: -1.2921, lng: 36.8219 },
    isActive: true
  }
];

// Sample products
const sampleProducts = [
  // Abai Springs Products
  {
    name: 'Abai Springs 500ml',
    brand: 'Abai Springs',
    category: '500ml',
    price: 20,
    description: 'Perfect for on-the-go hydration',
    stockLevel: 0, // Will be set per outlet
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=400&fit=crop'
  },
  {
    name: 'Abai Springs 1L',
    brand: 'Abai Springs',
    category: '1 Litre',
    price: 35,
    description: 'Ideal for daily hydration needs',
    stockLevel: 0,
    image: 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=400&h=400&fit=crop'
  },
  {
    name: 'Abai Springs 5L',
    brand: 'Abai Springs',
    category: '5 Litre',
    price: 150,
    description: 'Perfect for families and offices',
    stockLevel: 0,
    image: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=400&fit=crop'
  },
  {
    name: 'Abai Springs 20L',
    brand: 'Abai Springs',
    category: '20 Litre',
    price: 500,
    description: 'Great for large gatherings and events',
    stockLevel: 0,
    image: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=400&fit=crop'
  },
  // Sprinkle Products
  {
    name: 'Sprinkle 500ml',
    brand: 'Sprinkle',
    category: '500ml',
    price: 25,
    description: 'Premium hydration with natural minerals',
    stockLevel: 0,
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=400&fit=crop'
  },
  {
    name: 'Sprinkle 1L',
    brand: 'Sprinkle',
    category: '1 Litre',
    price: 40,
    description: 'Enhanced taste with added electrolytes',
    stockLevel: 0,
    image: 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=400&h=400&fit=crop'
  },
  {
    name: 'Sprinkle 5L',
    brand: 'Sprinkle',
    category: '5 Litre',
    price: 180,
    description: 'Family-sized premium water',
    stockLevel: 0,
    image: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=400&fit=crop'
  },
  {
    name: 'Sprinkle 10L',
    brand: 'Sprinkle',
    category: '10 Litre',
    price: 350,
    description: 'Large capacity for events and offices',
    stockLevel: 0,
    image: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=400&fit=crop'
  },
  {
    name: 'Sprinkle 20L',
    brand: 'Sprinkle',
    category: '20 Litre',
    price: 600,
    description: 'Premium water for large gatherings',
    stockLevel: 0,
    image: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=400&fit=crop'
  }
];

async function initializeInventory() {
  try {
    console.log('🔄 Starting inventory initialization...');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Outlet.deleteMany({});
    await Product.deleteMany({});
    await OutletInventory.deleteMany({});

    // Create outlets
    console.log('🏪 Creating outlets...');
    const createdOutlets = await Outlet.insertMany(sampleOutlets);
    console.log(`✅ Created ${createdOutlets.length} outlets`);

    // Create products
    console.log('📦 Creating products...');
    const createdProducts = await Product.insertMany(sampleProducts);
    console.log(`✅ Created ${createdProducts.length} products`);

    // Create outlet inventory for each outlet-product combination
    console.log('📊 Creating outlet inventory...');
    const inventoryRecords = [];

    for (const outlet of createdOutlets) {
      for (const product of createdProducts) {
        // Generate random stock levels
        const stockLevel = Math.floor(Math.random() * 100) + 20; // 20-120 units
        const reservedStock = Math.floor(Math.random() * 10); // 0-10 reserved
        const lowStockThreshold = 15; // Low stock threshold

        inventoryRecords.push({
          outlet: outlet._id,
          product: product._id,
          stockLevel,
          reservedStock,
          lowStockThreshold,
          isActive: true,
          notes: `Initial stock for ${outlet.name}`
        });
      }
    }

    await OutletInventory.insertMany(inventoryRecords);
    console.log(`✅ Created ${inventoryRecords.length} inventory records`);

    // Update product stock levels to show total across all outlets
    for (const product of createdProducts) {
      const totalStock = await OutletInventory.aggregate([
        { $match: { product: product._id } },
        { $group: { _id: null, total: { $sum: '$stockLevel' } } }
      ]);

      if (totalStock.length > 0) {
        await Product.findByIdAndUpdate(product._id, {
          stockLevel: totalStock[0].total
        });
      }
    }

    console.log('✅ Inventory initialization completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Outlets: ${createdOutlets.length}`);
    console.log(`   Products: ${createdProducts.length}`);
    console.log(`   Inventory Records: ${inventoryRecords.length}`);

    // Display sample inventory data
    console.log('\n📊 Sample Inventory Data:');
    const sampleInventory = await OutletInventory.find()
      .populate('outlet', 'name')
      .populate('product', 'name brand category')
      .limit(5);

    sampleInventory.forEach(inv => {
      console.log(`   ${inv.outlet.name} - ${inv.product.name}: ${inv.stockLevel} units (${inv.availableStock} available)`);
    });

  } catch (error) {
    console.error('❌ Error initializing inventory:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the initialization
initializeInventory();
