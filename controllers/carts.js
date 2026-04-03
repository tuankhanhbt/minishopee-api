var Cart = require('../schemas/carts');
var productController = require('./products');

function withCartPopulation(query) {
  return query.populate({
    path: 'items.productId',
    populate: [
      {
        path: 'sellerId',
        select: 'name email avatar role'
      },
      {
        path: 'categoryId',
        select: 'name slug image'
      }
    ]
  });
}

function normalizeCartItem(item) {
  if (!item || !item.productId) {
    return null;
  }

  var product = productController.sanitizeProduct(item.productId);
  var seller = product && product.sellerId ? product.sellerId : null;
  var quantity = Number(item.quantity || 0);
  var lineTotal = quantity * Number(product.price || 0);

  return {
    productId: product,
    quantity: quantity,
    lineTotal: lineTotal,
    sellerId: seller && seller._id ? String(seller._id) : String((seller && seller.id) || ''),
    isAvailable: Boolean(product && !product.isDeleted && product.isPublished && product.stock >= quantity)
  };
}

function buildSellerGroups(items) {
  var groupsBySeller = new Map();

  items.forEach(function (item) {
    if (!item || !item.productId || !item.sellerId) {
      return;
    }

    var existingGroup = groupsBySeller.get(item.sellerId);

    if (!existingGroup) {
      existingGroup = {
        sellerId: item.sellerId,
        seller: item.productId.sellerId,
        subtotal: 0,
        totalQuantity: 0,
        items: []
      };
      groupsBySeller.set(item.sellerId, existingGroup);
    }

    existingGroup.items.push(item);
    existingGroup.subtotal += item.lineTotal;
    existingGroup.totalQuantity += item.quantity;
  });

  return Array.from(groupsBySeller.values());
}

function sanitizeCart(cartDocument) {
  if (!cartDocument) {
    return null;
  }

  var cart = cartDocument.toObject ? cartDocument.toObject() : { ...cartDocument };
  var items = Array.isArray(cart.items)
    ? cart.items
        .map(normalizeCartItem)
        .filter(Boolean)
    : [];

  return {
    id: String(cart._id || ''),
    userId: String(cart.userId || ''),
    items: items,
    groups: buildSellerGroups(items),
    totalItems: items.length,
    totalQuantity: items.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0),
    subtotal: items.reduce(function (sum, item) {
      return sum + item.lineTotal;
    }, 0),
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt
  };
}

async function getCartByUserId(userId) {
  return withCartPopulation(Cart.findOne({ userId: userId }));
}

async function getOrCreateCartByUserId(userId) {
  var cart = await Cart.findOne({ userId: userId });

  if (!cart) {
    cart = await Cart.create({
      userId: userId,
      items: []
    });
  }

  return withCartPopulation(Cart.findById(cart._id));
}

async function addItemToCart(userId, productId, quantity) {
  var cart = await Cart.findOne({ userId: userId });

  if (!cart) {
    cart = new Cart({
      userId: userId,
      items: []
    });
  }

  var existingItem = cart.items.find(function (item) {
    return String(item.productId) === String(productId);
  });

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({
      productId: productId,
      quantity: quantity
    });
  }

  await cart.save();
  return getCartByUserId(userId);
}

async function updateCartItemQuantity(userId, productId, quantity) {
  var cart = await Cart.findOne({ userId: userId });

  if (!cart) {
    return null;
  }

  var existingItem = cart.items.find(function (item) {
    return String(item.productId) === String(productId);
  });

  if (!existingItem) {
    return null;
  }

  existingItem.quantity = quantity;
  await cart.save();
  return getCartByUserId(userId);
}

async function removeCartItem(userId, productId) {
  var cart = await Cart.findOne({ userId: userId });

  if (!cart) {
    return null;
  }

  var initialLength = cart.items.length;
  cart.items = cart.items.filter(function (item) {
    return String(item.productId) !== String(productId);
  });

  if (cart.items.length === initialLength) {
    return null;
  }

  await cart.save();
  return getCartByUserId(userId);
}

async function clearCart(userId) {
  var cart = await Cart.findOne({ userId: userId });

  if (!cart) {
    cart = await Cart.create({
      userId: userId,
      items: []
    });
  } else {
    cart.items = [];
    await cart.save();
  }

  return getCartByUserId(userId);
}

module.exports = {
  sanitizeCart: sanitizeCart,
  getCartByUserId: getCartByUserId,
  getOrCreateCartByUserId: getOrCreateCartByUserId,
  addItemToCart: addItemToCart,
  updateCartItemQuantity: updateCartItemQuantity,
  removeCartItem: removeCartItem,
  clearCart: clearCart
};
