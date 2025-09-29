// MongoDB initialization script for production

// Switch to the application database
db = db.getSiblingDB('abai_springs_prod');

// Create application user with appropriate permissions
db.createUser({
  user: 'abai_springs_user',
  pwd: 'secure_app_password_change_this',
  roles: [
    {
      role: 'readWrite',
      db: 'abai_springs_prod'
    }
  ]
});

// Create indexes for better performance
print('Creating indexes...');

// Users collection indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ phone: 1 });
db.users.createIndex({ role: 1 });
db.users.createIndex({ isActive: 1 });
db.users.createIndex({ createdAt: -1 });
db.users.createIndex({ loginAttempts: 1, lockUntil: 1 });

// Products collection indexes
db.products.createIndex({ name: 1 });
db.products.createIndex({ category: 1 });
db.products.createIndex({ brand: 1 });
db.products.createIndex({ price: 1 });
db.products.createIndex({ stockLevel: 1 });
db.products.createIndex({ isActive: 1 });
db.products.createIndex({ createdAt: -1 });
db.products.createIndex({ 
  name: 'text', 
  description: 'text', 
  brand: 'text' 
}, { 
  name: 'product_text_index' 
});

// Orders collection indexes
db.orders.createIndex({ customer: 1 });
db.orders.createIndex({ status: 1 });
db.orders.createIndex({ paymentStatus: 1 });
db.orders.createIndex({ outlet: 1 });
db.orders.createIndex({ createdAt: -1 });
db.orders.createIndex({ totalAmount: 1 });
db.orders.createIndex({ 'items.product': 1 });

// Outlets collection indexes
db.outlets.createIndex({ name: 1 });
db.outlets.createIndex({ city: 1 });
db.outlets.createIndex({ isActive: 1 });
db.outlets.createIndex({ location: '2dsphere' });

// Payments collection indexes
db.payments.createIndex({ order: 1 });
db.payments.createIndex({ customer: 1 });
db.payments.createIndex({ status: 1 });
db.payments.createIndex({ paymentMethod: 1 });
db.payments.createIndex({ transactionId: 1 }, { unique: true });
db.payments.createIndex({ createdAt: -1 });
db.payments.createIndex({ 'mpesaDetails.phoneNumber': 1 });

// Create sample data (optional - remove in production)
if (db.users.countDocuments() === 0) {
  print('Creating sample admin user...');
  
  // Sample admin user (change credentials in production)
  db.users.insertOne({
    name: 'Admin User',
    email: 'admin@abaisprings.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeU99dJsLWjUlOv2y', // password: admin123
    phone: '+254712345678',
    role: 'admin',
    isActive: true,
    addresses: [],
    loginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  print('Sample admin user created with email: admin@abaisprings.com and password: admin123');
  print('IMPORTANT: Change the admin password immediately in production!');
}

// Create sample products if none exist
if (db.products.countDocuments() === 0) {
  print('Creating sample products...');
  
  const sampleProducts = [
    {
      name: 'Abai Springs Pure Water 500ml',
      brand: 'Abai Springs',
      category: '500ml',
      price: 25,
      stockLevel: 1000,
      lowStockThreshold: 100,
      description: 'Pure, refreshing water in convenient 500ml bottles',
      imageUrl: '/images/500ml.png',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Abai Springs Pure Water 1L',
      brand: 'Abai Springs',
      category: '1 Litre',
      price: 40,
      stockLevel: 800,
      lowStockThreshold: 80,
      description: 'Pure, refreshing water in 1 litre bottles',
      imageUrl: '/images/1l.png',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Abai Springs Pure Water 5L',
      brand: 'Abai Springs',
      category: '5 Litres',
      price: 150,
      stockLevel: 500,
      lowStockThreshold: 50,
      description: 'Pure, refreshing water in 5 litre bottles',
      imageUrl: '/images/5l.png',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Abai Springs Pure Water 10L',
      brand: 'Abai Springs',
      category: '10 Litres',
      price: 280,
      stockLevel: 300,
      lowStockThreshold: 30,
      description: 'Pure, refreshing water in 10 litre bottles',
      imageUrl: '/images/10l.png',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'Abai Springs Pure Water 20L',
      brand: 'Abai Springs',
      category: '20 Litres',
      price: 500,
      stockLevel: 200,
      lowStockThreshold: 20,
      description: 'Pure, refreshing water in 20 litre bottles',
      imageUrl: '/images/20l.png',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  db.products.insertMany(sampleProducts);
  print('Sample products created');
}

// Create sample outlet if none exist
if (db.outlets.countDocuments() === 0) {
  print('Creating sample outlet...');
  
  db.outlets.insertOne({
    name: 'Abai Springs Main Office',
    address: '123 Main Street, Nairobi',
    city: 'Nairobi',
    phone: '+254712345678',
    email: 'main@abaisprings.com',
    coordinates: {
      lat: -1.2921,
      lng: 36.8219
    },
    operatingHours: {
      monday: { open: '08:00', close: '18:00', isOpen: true },
      tuesday: { open: '08:00', close: '18:00', isOpen: true },
      wednesday: { open: '08:00', close: '18:00', isOpen: true },
      thursday: { open: '08:00', close: '18:00', isOpen: true },
      friday: { open: '08:00', close: '18:00', isOpen: true },
      saturday: { open: '09:00', close: '16:00', isOpen: true },
      sunday: { open: '10:00', close: '14:00', isOpen: false }
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  print('Sample outlet created');
}

print('Database initialization completed successfully!');
print('');
print('PRODUCTION SECURITY REMINDERS:');
print('1. Change the default admin password immediately');
print('2. Update the database user password');
print('3. Remove or modify sample data as needed');
print('4. Ensure all environment variables are properly set');
print('5. Enable MongoDB authentication in production');
print('');






