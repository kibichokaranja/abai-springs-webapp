import mongoose from 'mongoose';

const outletInventorySchema = new mongoose.Schema({
  outlet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Outlet',
    required: [true, 'Outlet is required'],
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required'],
    index: true
  },
  stockLevel: {
    type: Number,
    default: 0,
    min: [0, 'Stock level cannot be negative'],
    required: [true, 'Stock level is required']
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: [0, 'Low stock threshold cannot be negative']
  },
  reservedStock: {
    type: Number,
    default: 0,
    min: [0, 'Reserved stock cannot be negative']
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Compound unique index to ensure one inventory record per outlet-product combination
outletInventorySchema.index({ outlet: 1, product: 1 }, { unique: true });

// Indexes for common queries
outletInventorySchema.index({ outlet: 1, isActive: 1 });
outletInventorySchema.index({ product: 1, isActive: 1 });
outletInventorySchema.index({ stockLevel: 1, lowStockThreshold: 1 });
outletInventorySchema.index({ lastRestocked: -1 });

// Virtual for available stock (stockLevel - reservedStock)
outletInventorySchema.virtual('availableStock').get(function() {
  return Math.max(0, this.stockLevel - this.reservedStock);
});

// Virtual for stock status
outletInventorySchema.virtual('stockStatus').get(function() {
  const available = this.availableStock;
  if (available === 0) return 'out_of_stock';
  if (available <= this.lowStockThreshold) return 'low_stock';
  return 'in_stock';
});

// Static method to check stock availability
outletInventorySchema.statics.checkStock = async function(outletId, productId, quantity = 1) {
  const inventory = await this.findOne({
    outlet: outletId,
    product: productId,
    isActive: true
  });
  
  if (!inventory) return { available: false, message: 'Product not available at this outlet' };
  
  const available = inventory.availableStock;
  return {
    available: available >= quantity,
    availableStock: available,
    message: available >= quantity ? 'Stock available' : `Only ${available} units available`
  };
};

// Static method to reserve stock
outletInventorySchema.statics.reserveStock = async function(outletId, productId, quantity) {
  const inventory = await this.findOne({
    outlet: outletId,
    product: productId,
    isActive: true
  });
  
  if (!inventory) {
    throw new Error('Product not available at this outlet');
  }
  
  if (inventory.availableStock < quantity) {
    throw new Error(`Insufficient stock. Available: ${inventory.availableStock}, Requested: ${quantity}`);
  }
  
  inventory.reservedStock += quantity;
  await inventory.save();
  
  return inventory;
};

// Static method to release reserved stock
outletInventorySchema.statics.releaseStock = async function(outletId, productId, quantity) {
  const inventory = await this.findOne({
    outlet: outletId,
    product: productId,
    isActive: true
  });
  
  if (!inventory) {
    throw new Error('Product not available at this outlet');
  }
  
  inventory.reservedStock = Math.max(0, inventory.reservedStock - quantity);
  await inventory.save();
  
  return inventory;
};

// Static method to update stock after order completion
outletInventorySchema.statics.updateStockAfterOrder = async function(outletId, productId, quantity) {
  const inventory = await this.findOne({
    outlet: outletId,
    product: productId,
    isActive: true
  });
  
  if (!inventory) {
    throw new Error('Product not available at this outlet');
  }
  
  // Reduce both stock level and reserved stock
  inventory.stockLevel = Math.max(0, inventory.stockLevel - quantity);
  inventory.reservedStock = Math.max(0, inventory.reservedStock - quantity);
  await inventory.save();
  
  return inventory;
};

// Ensure virtuals are included in JSON output
outletInventorySchema.set('toJSON', { virtuals: true });

export default mongoose.model('OutletInventory', outletInventorySchema);
