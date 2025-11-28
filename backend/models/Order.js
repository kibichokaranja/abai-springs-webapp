import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Make customer optional for now
    index: true // Index for customer-based queries
  },
  customerName: {
    type: String,
    required: false,
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters']
  },
  customerEmail: {
    type: String,
    required: false,
    trim: true,
    lowercase: true,
    maxlength: [100, 'Customer email cannot exceed 100 characters']
  },
  customerPhone: {
    type: String,
    required: false,
    trim: true,
    maxlength: [20, 'Customer phone cannot exceed 20 characters']
  },
  outlet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Outlet',
    required: false, // Make outlet optional for now
    index: true // Index for outlet-based queries
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative']
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative']
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: [0, 'Delivery fee cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending',
    index: true // Index for status-based queries
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true // Index for payment status queries
  },
  paymentMethod: {
    type: String,
    enum: ['mpesa', 'card', 'cash_on_delivery'],
    default: 'mpesa',
    index: true // Index for payment method queries
  },
  paymentTiming: {
    type: String,
    enum: ['now', 'delivery'],
    default: 'now',
    index: true // Index for payment timing queries
  },
  deliveryAddress: {
    type: {
      type: String,
      enum: ['home', 'office', 'other'],
      default: 'home'
    },
    address: {
      type: String,
      required: [true, 'Delivery address is required']
    },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  deliveryInstructions: {
    type: String,
    maxlength: [200, 'Delivery instructions cannot exceed 200 characters']
  },
  deliverySlot: {
    type: String,
    maxlength: [100, 'Delivery slot cannot exceed 100 characters']
  },
  estimatedDeliveryTime: {
    type: Date
  },
  actualDeliveryTime: {
    type: Date
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  cancellationReason: {
    type: String,
    maxlength: [200, 'Cancellation reason cannot exceed 200 characters']
  }
}, {
  timestamps: true
});

// Compound indexes for common query patterns
orderSchema.index({ customer: 1, createdAt: -1 }); // Customer orders by date
orderSchema.index({ outlet: 1, status: 1 }); // Outlet orders by status
orderSchema.index({ status: 1, createdAt: -1 }); // Orders by status and date
orderSchema.index({ paymentStatus: 1, createdAt: -1 }); // Payment status queries
orderSchema.index({ customer: 1, status: 1 }); // Customer orders by status
orderSchema.index({ customer: 1, paymentStatus: 1 }); // Customer orders by payment
orderSchema.index({ outlet: 1, paymentStatus: 1 }); // Outlet orders by payment
orderSchema.index({ paymentMethod: 1, createdAt: -1 }); // Payment method analytics
orderSchema.index({ paymentTiming: 1, createdAt: -1 }); // Payment timing analytics
orderSchema.index({ totalAmount: 1, createdAt: -1 }); // Revenue analytics
orderSchema.index({ status: 1, paymentStatus: 1 }); // Status + payment queries
orderSchema.index({ customerEmail: 1, createdAt: -1 }); // Customer email queries
orderSchema.index({ customerPhone: 1, createdAt: -1 }); // Customer phone queries

// Virtual for order summary
orderSchema.virtual('orderSummary').get(function() {
  return {
    itemCount: this.items.length,
    totalItems: this.items.reduce((sum, item) => sum + item.quantity, 0),
    status: this.status,
    paymentStatus: this.paymentStatus
  };
});

// Ensure virtuals are included in JSON output
orderSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Order', orderSchema); 