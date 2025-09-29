import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters'],
    index: true // Index for product name searches
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    enum: ['Abai Springs', 'Sprinkle'],
    default: 'Abai Springs',
    index: true // Index for brand-based queries
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['500ml', '1 Litre', '2 Litre', '5 Litre', '10 Litre', '20 Litre'],
    default: '500ml',
    index: true // Index for category-based queries
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    index: true // Index for price-based queries
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    type: String,
    required: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // Index for active product queries
  },
  stockLevel: {
    type: Number,
    default: 0,
    min: [0, 'Stock level cannot be negative'],
    index: true // Index for stock-based queries
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: [0, 'Low stock threshold cannot be negative']
  },
  tags: [{
    type: String,
    trim: true
  }],
  specifications: {
    volume: String,
    material: String,
    features: [String]
  }
}, {
  timestamps: true
});

// Compound indexes for common query patterns
productSchema.index({ brand: 1, category: 1, isActive: 1 }); // Brand + category + active
productSchema.index({ category: 1, isActive: 1, price: 1 }); // Category + active + price
productSchema.index({ brand: 1, isActive: 1, price: 1 }); // Brand + active + price
productSchema.index({ isActive: 1, stockLevel: 1 }); // Active + stock level
productSchema.index({ createdAt: -1, isActive: 1 }); // Recent products
productSchema.index({ updatedAt: -1, isActive: 1 }); // Recently updated

// Text search index for product search
productSchema.index({ 
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

// Price range index for filtering
productSchema.index({ price: 1, isActive: 1 });

// Stock monitoring index
productSchema.index({ stockLevel: 1, lowStockThreshold: 1, isActive: 1 });

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.stockLevel === 0) return 'out_of_stock';
  if (this.stockLevel <= this.lowStockThreshold) return 'low_stock';
  return 'in_stock';
});

// Ensure virtuals are included in JSON output
productSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Product', productSchema); 