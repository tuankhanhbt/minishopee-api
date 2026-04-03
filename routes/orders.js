var express = require('express');
var orderController = require('../controllers/orders');
var cartController = require('../controllers/carts');
var productController = require('../controllers/products');
var authHandler = require('../utils/authHandler');

var router = express.Router();
var SELLER_STATUS_TRANSITIONS = {
  Pending: ['Processing'],
  Processing: ['Shipped']
};

function normalizeAddress(address) {
  if (!address || typeof address !== 'object') {
    return null;
  }

  return {
    fullName: address.fullName ? String(address.fullName).trim() : '',
    phone: address.phone ? String(address.phone).trim() : '',
    street: address.street ? String(address.street).trim() : '',
    ward: address.ward ? String(address.ward).trim() : '',
    district: address.district ? String(address.district).trim() : '',
    city: address.city ? String(address.city).trim() : '',
    country: address.country ? String(address.country).trim() : 'Vietnam'
  };
}

function isShippingAddressComplete(address) {
  return Boolean(
    address &&
      address.fullName &&
      address.phone &&
      address.street &&
      address.district &&
      address.city &&
      address.country
  );
}

function pickShippingAddress(user, body) {
  var normalizedBodyAddress = normalizeAddress(body && body.shippingAddress);
  if (normalizedBodyAddress && isShippingAddressComplete(normalizedBodyAddress)) {
    return normalizedBodyAddress;
  }

  var addresses = Array.isArray(user && user.addresses) ? user.addresses : [];
  var requestedIndex = body && body.addressIndex !== undefined ? Number(body.addressIndex) : null;

  if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < addresses.length) {
    var indexedAddress = normalizeAddress(addresses[requestedIndex]);
    if (indexedAddress && isShippingAddressComplete(indexedAddress)) {
      return indexedAddress;
    }
  }

  var defaultAddress = addresses.find(function (address) {
    return address.isDefault;
  });

  if (defaultAddress) {
    var normalizedDefault = normalizeAddress(defaultAddress);
    if (normalizedDefault && isShippingAddressComplete(normalizedDefault)) {
      return normalizedDefault;
    }
  }

  if (addresses.length) {
    var normalizedFirst = normalizeAddress(addresses[0]);
    if (normalizedFirst && isShippingAddressComplete(normalizedFirst)) {
      return normalizedFirst;
    }
  }

  return normalizedBodyAddress;
}

function getUserIdFromRef(userRef) {
  return String(userRef && (userRef._id || userRef.id || userRef));
}

function canAccessOrder(order, user) {
  return (
    user.role === 'Admin' ||
    getUserIdFromRef(order.buyerId) === String(user._id || user.id || user) ||
    getUserIdFromRef(order.sellerId) === String(user._id || user.id || user)
  );
}

function canManageOrderAsSeller(order, user) {
  return user.role === 'Admin' || getUserIdFromRef(order.sellerId) === String(user._id || user.id || user);
}

function canReceiveOrder(order, user) {
  return user.role === 'Admin' || getUserIdFromRef(order.buyerId) === String(user._id || user.id || user);
}

function canCancelOrderAsBuyer(order, user) {
  return user.role === 'Admin' || getUserIdFromRef(order.buyerId) === String(user._id || user.id || user);
}

router.post('/checkout', authHandler.protect, async function (req, res, next) {
  var reservedStocks = [];
  var createdOrders = [];

  try {
    var cart = await cartController.getCartByUserId(req.userId);
    var cartItems = cart && Array.isArray(cart.items) ? cart.items : [];

    if (!cartItems.length) {
      return res.status(400).json({
        message: 'cart is empty'
      });
    }

    var shippingAddress = pickShippingAddress(req.user, req.body || {});

    if (!isShippingAddressComplete(shippingAddress)) {
      return res.status(400).json({
        message: 'a complete shippingAddress or a valid saved address is required for checkout'
      });
    }

    var ordersBySeller = new Map();

    for (var index = 0; index < cartItems.length; index += 1) {
      var cartItem = cartItems[index];
      var product = cartItem.productId;
      var quantity = Number(cartItem.quantity || 0);

      if (!product || product.isDeleted || !product.isPublished) {
        return res.status(400).json({
          message: 'cart contains unavailable products'
        });
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          message: 'cart contains invalid quantities'
        });
      }

      var reservedProduct = await productController.reserveStock(product._id, quantity);

      if (!reservedProduct) {
        await productController.restoreStocks(reservedStocks);

        return res.status(400).json({
          message: 'insufficient stock for product: ' + product.name
        });
      }

      reservedStocks.push({
        productId: product._id,
        quantity: quantity
      });

      var sellerId = String(product.sellerId && (product.sellerId._id || product.sellerId));
      var existingOrder = ordersBySeller.get(sellerId);

      if (!existingOrder) {
        existingOrder = {
          buyerId: req.userId,
          sellerId: sellerId,
          shippingAddress: shippingAddress,
          totalAmount: 0,
          orderItems: []
        };
        ordersBySeller.set(sellerId, existingOrder);
      }

      existingOrder.orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        image: Array.isArray(product.images) && product.images.length ? product.images[0] : ''
      });
      existingOrder.totalAmount += Number(product.price || 0) * quantity;
    }

    createdOrders = await orderController.createOrders(Array.from(ordersBySeller.values()));
    await cartController.clearCart(req.userId);

    return res.status(201).json({
      message: 'checkout completed successfully',
      totalOrders: createdOrders.length,
      totalAmount: createdOrders.reduce(function (sum, order) {
        return sum + Number(order.totalAmount || 0);
      }, 0),
      orders: createdOrders.map(orderController.sanitizeOrder)
    });
  } catch (error) {
    try {
      if (createdOrders.length) {
        await orderController.deleteOrdersByIds(
          createdOrders.map(function (order) {
            return order._id;
          })
        );
      }

      if (reservedStocks.length) {
        await productController.restoreStocks(reservedStocks);
      }
    } catch (rollbackError) {
      return next(rollbackError);
    }

    if (error && error.name === 'ValidationError') {
      return res.status(400).json({
        message: error.message
      });
    }

    return next(error);
  }
});

router.get('/my-orders', authHandler.protect, async function (req, res, next) {
  try {
    var orders = await orderController.getBuyerOrders(req.userId);

    return res.json({
      total: orders.length,
      orders: orders.map(orderController.sanitizeOrder)
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/my-sales', authHandler.protect, async function (req, res, next) {
  try {
    var orders = await orderController.getSellerOrders(req.userId);

    return res.json({
      total: orders.length,
      orders: orders.map(orderController.sanitizeOrder)
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', authHandler.protect, async function (req, res, next) {
  try {
    var order = await orderController.getOrderById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'order not found'
      });
    }

    if (!canAccessOrder(order, req.user)) {
      return res.status(403).json({
        message: 'you do not have permission to perform this action'
      });
    }

    return res.json({
      order: orderController.sanitizeOrder(order)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'order not found'
      });
    }

    return next(error);
  }
});

router.patch('/:id/status', authHandler.protect, async function (req, res, next) {
  try {
    var order = await orderController.getOrderById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'order not found'
      });
    }

    if (!canManageOrderAsSeller(order, req.user)) {
      return res.status(403).json({
        message: 'you do not have permission to perform this action'
      });
    }

    var nextStatus = req.body && req.body.status ? String(req.body.status).trim() : '';
    var allowedNextStatuses = SELLER_STATUS_TRANSITIONS[order.status] || [];

    if (!allowedNextStatuses.includes(nextStatus)) {
      return res.status(400).json({
        message: 'invalid status transition'
      });
    }

    var updatedOrder = await orderController.updateOrder(req.params.id, {
      status: nextStatus
    });

    return res.json({
      message: 'order status updated successfully',
      order: orderController.sanitizeOrder(updatedOrder)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'order not found'
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

router.patch('/:id/receive', authHandler.protect, async function (req, res, next) {
  try {
    var order = await orderController.getOrderById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'order not found'
      });
    }

    if (!canReceiveOrder(order, req.user)) {
      return res.status(403).json({
        message: 'you do not have permission to perform this action'
      });
    }

    if (order.status !== 'Shipped') {
      return res.status(400).json({
        message: 'only shipped orders can be marked as delivered'
      });
    }

    var updatedOrder = await orderController.updateOrder(req.params.id, {
      status: 'Delivered'
    });

    return res.json({
      message: 'order marked as delivered successfully',
      order: orderController.sanitizeOrder(updatedOrder)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'order not found'
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

router.patch('/:id/cancel', authHandler.protect, async function (req, res, next) {
  try {
    var order = await orderController.getOrderById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'order not found'
      });
    }

    if (!canCancelOrderAsBuyer(order, req.user)) {
      return res.status(403).json({
        message: 'you do not have permission to perform this action'
      });
    }

    if (order.status !== 'Pending') {
      return res.status(400).json({
        message: 'only pending orders can be cancelled'
      });
    }

    await productController.restoreStocks(
      (order.orderItems || []).map(function (item) {
        return {
          productId: item.productId,
          quantity: item.quantity
        };
      })
    );

    var updatedOrder = await orderController.updateOrder(req.params.id, {
      status: 'Cancelled'
    });

    return res.json({
      message: 'order cancelled successfully',
      order: orderController.sanitizeOrder(updatedOrder)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'order not found'
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

module.exports = router;
