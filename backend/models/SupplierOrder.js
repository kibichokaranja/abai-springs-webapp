import mongoose from 'mongoose';

const supplierOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: false, // Auto-generated in pre-save hook
    unique: true,
    index: true,
    trim: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Supplier is required'],
    index: true
  },
  items: [{
    itemType: {
      type: String,
      required: true,
      enum: ['bottles', 'bottle_tops', 'branding', 'labels', 'packaging', 'other'],
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters']
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative']
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative']
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: [0, 'Shipping cost cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'ordered', 'in_transit', 'received', 'cancelled'],
    default: 'pending',
    index: true
  },
  orderDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  expectedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  orderedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: false, // Will be set automatically if not provided
    index: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  invoiceNumber: {
    type: String,
    trim: true,
    maxlength: [100, 'Invoice number cannot exceed 100 characters']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'overdue'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

// Generate order number before saving (only if not already set)
supplierOrderSchema.pre('save', async function(next) {
  if (!this.orderNumber || this.orderNumber.trim() === '') {
    try {
      const count = await mongoose.model('SupplierOrder').countDocuments();
      // Generate unique order number
      const timestamp = Date.now();
      const sequence = String(count + 1).padStart(4, '0');
      this.orderNumber = `SUP-${timestamp}-${sequence}`;
      console.log('Generated order number:', this.orderNumber);
    } catch (error) {
      console.error('Error generating order number:', error);
      // Fallback order number if count fails
      this.orderNumber = `SUP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }
  }
  next();
});

// Indexes for efficient queries
supplierOrderSchema.index({ supplier: 1, status: 1 });
supplierOrderSchema.index({ status: 1, orderDate: -1 });
supplierOrderSchema.index({ orderedBy: 1, orderDate: -1 });
supplierOrderSchema.index({ paymentStatus: 1, orderDate: -1 });
supplierOrderSchema.index({ orderDate: -1 });

export default mongoose.model('SupplierOrder', supplierOrderSchema);


