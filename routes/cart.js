var express = require('express');
var mongoose = require('mongoose');
var cartController = require('../controllers/carts');
var productController = require('../controllers/products');
var authHandler = require('../utils/authHandler');

var router = express.Router();

function parsePositiveInteger(value) {
  var parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

router.get('/', authHandler.protect, async function (req, res, next) {
  try {
    var cart = await cartController.getOrCreateCartByUserId(req.userId);

    return res.json({
      cart: cartController.sanitizeCart(cart)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/items', authHandler.protect, async function (req, res, next) {
  try {
    var body = req.body || {};
    var productId = body.productId ? String(body.productId).trim() : '';
    var quantity = parsePositiveInteger(body.quantity);

    if (!productId || !isValidObjectId(productId) || quantity === null) {
      return res.status(400).json({
        message: 'productId and a positive integer quantity are required'
      });
    }

    var product = await productController.getProductById(productId);

    if (!product || product.isDeleted || !product.isPublished) {
      return res.status(404).json({
        message: 'product not found'
      });
    }

    var currentCart = await cartController.getOrCreateCartByUserId(req.userId);
    var existingItem = currentCart && Array.isArray(currentCart.items)
      ? currentCart.items.find(function (item) {
          return item.productId && String(item.productId._id || item.productId) === productId;
        })
      : null;
    var requestedQuantity = quantity + Number((existingItem && existingItem.quantity) || 0);

    if (requestedQuantity > product.stock) {
      return res.status(400).json({
        message: 'requested quantity exceeds available stock'
      });
    }

    var updatedCart = await cartController.addItemToCart(req.userId, productId, quantity);

    return res.status(201).json({
      message: 'item added to cart successfully',
      cart: cartController.sanitizeCart(updatedCart)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/items/:productId', authHandler.protect, async function (req, res, next) {
  try {
    var productId = String(req.params.productId || '').trim();
    var quantity = parsePositiveInteger((req.body || {}).quantity);

    if (!productId || !isValidObjectId(productId) || quantity === null) {
      return res.status(400).json({
        message: 'productId and a positive integer quantity are required'
      });
    }

    var product = await productController.getProductById(productId);

    if (!product || product.isDeleted || !product.isPublished) {
      return res.status(404).json({
        message: 'product not found'
      });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        message: 'requested quantity exceeds available stock'
      });
    }

    var updatedCart = await cartController.updateCartItemQuantity(req.userId, productId, quantity);

    if (!updatedCart) {
      return res.status(404).json({
        message: 'cart item not found'
      });
    }

    return res.json({
      message: 'cart item updated successfully',
      cart: cartController.sanitizeCart(updatedCart)
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/items/:productId', authHandler.protect, async function (req, res, next) {
  try {
    var productId = String(req.params.productId || '').trim();

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        message: 'valid productId is required'
      });
    }

    var updatedCart = await cartController.removeCartItem(req.userId, productId);

    if (!updatedCart) {
      return res.status(404).json({
        message: 'cart item not found'
      });
    }

    return res.json({
      message: 'cart item removed successfully',
      cart: cartController.sanitizeCart(updatedCart)
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/', authHandler.protect, async function (req, res, next) {
  try {
    var clearedCart = await cartController.clearCart(req.userId);

    return res.json({
      message: 'cart cleared successfully',
      cart: cartController.sanitizeCart(clearedCart)
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
