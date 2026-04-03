var mongoose = require('mongoose');

var reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required']
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'productId is required']
    },
    rating: {
      type: Number,
      required: [true, 'rating is required'],
      min: [1, 'rating must be at least 1'],
      max: [5, 'rating cannot be greater than 5']
    },
    comment: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

reviewSchema.index(
  {
    userId: 1,
    productId: 1
  },
  {
    unique: true
  }
);

module.exports = mongoose.model('Review', reviewSchema);
