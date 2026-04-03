var mongoose = require('mongoose');

var productSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'sellerId is required']
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'categoryId is required']
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'slug is required'],
      trim: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    price: {
      type: Number,
      required: [true, 'price is required'],
      min: [0, 'price cannot be negative']
    },
    stock: {
      type: Number,
      required: [true, 'stock is required'],
      min: [0, 'stock cannot be negative']
    },
    images: {
      type: [String],
      default: []
    },
    ratingsAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    isPublished: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

productSchema.index({ sellerId: 1, createdAt: -1 });
productSchema.index({ categoryId: 1, createdAt: -1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);
