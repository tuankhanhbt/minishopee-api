var mongoose = require('mongoose');
var Review = require('../schemas/reviews');
var Order = require('../schemas/orders');
var productController = require('./products');

function withReviewPopulation(query) {
  return query
    .populate('userId', 'name email avatar role')
    .populate('productId', 'name slug images ratingsAverage ratingsQuantity');
}

function sanitizeReview(reviewDocument) {
  if (!reviewDocument) {
    return null;
  }

  var review = reviewDocument.toObject ? reviewDocument.toObject() : { ...reviewDocument };
  delete review.__v;
  return review;
}

async function updateProductRatingSummary(productId) {
  var stats = await Review.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(String(productId))
      }
    },
    {
      $group: {
        _id: '$productId',
        ratingsAverage: {
          $avg: '$rating'
        },
        ratingsQuantity: {
          $sum: 1
        }
      }
    }
  ]);

  if (!stats.length) {
    await productController.setProductRatings(productId, 0, 0);
    return;
  }

  await productController.setProductRatings(
    productId,
    Number(stats[0].ratingsAverage.toFixed(1)),
    stats[0].ratingsQuantity
  );
}

async function getReviewById(id) {
  return withReviewPopulation(Review.findById(id));
}

async function getProductReviews(productId) {
  return withReviewPopulation(
    Review.find({
      productId: productId
    }).sort({ createdAt: -1 })
  );
}

async function findUserReviewForProduct(userId, productId) {
  return Review.findOne({
    userId: userId,
    productId: productId
  });
}

async function hasDeliveredOrderForProduct(userId, productId) {
  return Order.findOne({
    buyerId: userId,
    status: 'Delivered',
    'orderItems.productId': productId
  });
}

async function createReview(payload) {
  var review = new Review(payload);
  await review.save();
  await updateProductRatingSummary(review.productId);
  return withReviewPopulation(Review.findById(review._id));
}

async function updateReview(id, payload) {
  var review = await Review.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  });

  if (!review) {
    return null;
  }

  await updateProductRatingSummary(review.productId);
  return withReviewPopulation(Review.findById(review._id));
}

async function deleteReview(id) {
  var review = await Review.findByIdAndDelete(id);

  if (!review) {
    return null;
  }

  await updateProductRatingSummary(review.productId);
  return review;
}

module.exports = {
  sanitizeReview: sanitizeReview,
  getReviewById: getReviewById,
  getProductReviews: getProductReviews,
  findUserReviewForProduct: findUserReviewForProduct,
  hasDeliveredOrderForProduct: hasDeliveredOrderForProduct,
  createReview: createReview,
  updateReview: updateReview,
  deleteReview: deleteReview,
  updateProductRatingSummary: updateProductRatingSummary
};
