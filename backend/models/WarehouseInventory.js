import mongoose from 'mongoose';

const warehouseInventorySchema = new mongoose.Schema({
  itemType: {
    type: String,
    required: [true, 'Item type is required'],
    enum: ['bottles', 'bottle_tops', 'branding', 'labels', 'packaging', 'other'],
    index: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Quantity cannot be negative']
  },
  unit: {
    type: String,
    required: true,
    enum: ['pieces', 'boxes', 'rolls', 'sheets', 'units'],
    default: 'pieces'
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: [0, 'Low stock threshold cannot be negative']
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters'],
    default: 'Main Warehouse'
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  lastRestockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
warehouseInventorySchema.index({ itemType: 1, isActive: 1 });
warehouseInventorySchema.index({ quantity: 1, lowStockThreshold: 1 });
warehouseInventorySchema.index({ isActive: 1, createdAt: -1 });

// Virtual for stock status
warehouseInventorySchema.virtual('stockStatus').get(function() {
  if (this.quantity === 0) return 'out_of_stock';
  if (this.quantity <= this.lowStockThreshold) return 'low_stock';
  return 'in_stock';
});

// Ensure virtuals are included in JSON output
warehouseInventorySchema.set('toJSON', { virtuals: true });

export default mongoose.model('WarehouseInventory', warehouseInventorySchema);









