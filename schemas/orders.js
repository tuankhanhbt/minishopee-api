var mongoose = require('mongoose');

var shippingAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'shipping fullName is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'shipping phone is required'],
      trim: true
    },
    street: {
      type: String,
      required: [true, 'shipping street is required'],
      trim: true
    },
    ward: {
      type: String,
      trim: true,
      default: ''
    },
    district: {
      type: String,
      required: [true, 'shipping district is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'shipping city is required'],
      trim: true
    },
    country: {
      type: String,
      required: [true, 'shipping country is required'],
      trim: true,
      default: 'Vietnam'
    }
  },
  {
    _id: false
  }
);

var orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'productId is required']
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'price is required'],
      min: [0, 'price cannot be negative']
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [1, 'quantity must be at least 1']
    },
    image: {
      type: String,
      default: ''
    }
  },
  {
    _id: false
  }
);

var orderSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'buyerId is required'],
      index: true
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'sellerId is required'],
      index: true
    },
    orderItems: {
      type: [orderItemSchema],
      required: [true, 'orderItems are required'],
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'orderItems must not be empty'
      }
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, 'shippingAddress is required']
    },
    totalAmount: {
      type: Number,
      required: [true, 'totalAmount is required'],
      min: [0, 'totalAmount cannot be negative']
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Pending'
    }
  },
  {
    timestamps: true
  }
);

orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
