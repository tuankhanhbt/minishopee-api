var express = require('express');
var mongoose = require('mongoose');
var reviewController = require('../controllers/reviews');
var productController = require('../controllers/products');
var authHandler = require('../utils/authHandler');

var router = express.Router();

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function parseRating(value) {
  var rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }

  return rating;
}

function canManageReview(review, user) {
  return String(review.userId._id || review.userId) === String(user._id || user.id || user) || user.role === 'Admin';
}

router.get('/product/:productId', async function (req, res, next) {
  try {
    var productId = String(req.params.productId || '').trim();

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        message: 'valid productId is required'
      });
    }

    var reviews = await reviewController.getProductReviews(productId);

    return res.json({
      total: reviews.length,
      reviews: reviews.map(reviewController.sanitizeReview)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', authHandler.protect, async function (req, res, next) {
  try {
    var body = req.body || {};
    var productId = body.productId ? String(body.productId).trim() : '';
    var rating = parseRating(body.rating);
    var comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    if (!productId || !isValidObjectId(productId) || rating === null) {
      return res.status(400).json({
        message: 'productId and integer rating from 1 to 5 are required'
      });
    }

    var product = await productController.getProductById(productId);

    if (!product || product.isDeleted) {
      return res.status(404).json({
        message: 'product not found'
      });
    }

    var deliveredOrder = await reviewController.hasDeliveredOrderForProduct(req.userId, productId);

    if (!deliveredOrder) {
      return res.status(403).json({
        message: 'you can only review products from delivered orders'
      });
    }

    var existingReview = await reviewController.findUserReviewForProduct(req.userId, productId);

    if (existingReview) {
      return res.status(409).json({
        message: 'you have already reviewed this product'
      });
    }

    var review = await reviewController.createReview({
      userId: req.userId,
      productId: productId,
      rating: rating,
      comment: comment
    });

    return res.status(201).json({
      message: 'review created successfully',
      review: reviewController.sanitizeReview(review)
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        message: 'you have already reviewed this product'
      });
    }

    if (error && error.name === 'ValidationError') {
      return res.status(400).json({
        message: error.message
      });
    }

    return next(error);
  }
});

router.patch('/:id', authHandler.protect, async function (req, res, next) {
  try {
    var review = await reviewController.getReviewById(req.params.id);

    if (!review) {
      return res.status(404).json({
        message: 'review not found'
      });
    }

    if (!canManageReview(review, req.user)) {
      return res.status(403).json({
        message: 'you do not have permission to perform this action'
      });
    }

    var body = req.body || {};
    var updatePayload = {};

    if (body.rating !== undefined) {
      var rating = parseRating(body.rating);

      if (rating === null) {
        return res.status(400).json({
          message: 'rating must be an integer from 1 to 5'
        });
      }

      updatePayload.rating = rating;
    }

    if (typeof body.comment === 'string') {
      updatePayload.comment = body.comment.trim();
    }

    var updatedReview = await reviewController.updateReview(req.params.id, updatePayload);

    return res.json({
      message: 'review updated successfully',
      review: reviewController.sanitizeReview(updatedReview)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'review not found'
      });
    }

    if (error && error.name === 'ValidationError') {
      return res.status(400).json({
        message: error.message
      });
    }

    return next(error);
  }
});

router.delete('/:id', authHandler.protect, async function (req, res, next) {
  try {
    var review = await reviewController.getReviewById(req.params.id);

    if (!review) {
      return res.status(404).json({
        message: 'review not found'
      });
    }

    if (!canManageReview(review, req.user)) {
      return res.status(403).json({
        message: 'you do not have permission to perform this action'
      });
    }

    var deletedReview = await reviewController.deleteReview(req.params.id);

    return res.json({
      message: 'review deleted successfully',
      review: reviewController.sanitizeReview(deletedReview)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'review not found'
      });
    }

    return next(error);
  }
});

module.exports = router;
