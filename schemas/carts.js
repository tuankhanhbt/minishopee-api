var mongoose = require('mongoose');

var cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'productId is required']
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [1, 'quantity must be at least 1']
    }
  },
  {
    _id: false
  }
);

var cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      unique: true,
      index: true
    },
    items: {
      type: [cartItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Cart', cartSchema);
