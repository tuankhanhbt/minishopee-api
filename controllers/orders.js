var Order = require('../schemas/orders');

function withOrderPopulation(query) {
  return query
    .populate('buyerId', 'name email avatar role')
    .populate('sellerId', 'name email avatar role');
}

function sanitizeOrder(orderDocument) {
  if (!orderDocument) {
    return null;
  }

  var order = orderDocument.toObject ? orderDocument.toObject() : { ...orderDocument };
  delete order.__v;
  return order;
}

async function createOrders(payloads) {
  var orders = await Order.insertMany(payloads);
  var orderIds = orders.map(function (order) {
    return order._id;
  });

  return withOrderPopulation(
    Order.find({
      _id: {
        $in: orderIds
      }
    }).sort({ createdAt: -1 })
  );
}

async function deleteOrdersByIds(orderIds) {
  if (!Array.isArray(orderIds) || !orderIds.length) {
    return;
  }

  await Order.deleteMany({
    _id: {
      $in: orderIds
    }
  });
}

async function getBuyerOrders(buyerId) {
  return withOrderPopulation(
    Order.find({
      buyerId: buyerId
    }).sort({ createdAt: -1 })
  );
}

async function getSellerOrders(sellerId) {
  return withOrderPopulation(
    Order.find({
      sellerId: sellerId
    }).sort({ createdAt: -1 })
  );
}

async function getOrderById(id) {
  return withOrderPopulation(Order.findById(id));
}

async function updateOrder(id, payload) {
  return withOrderPopulation(
    Order.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    })
  );
}

module.exports = {
  sanitizeOrder: sanitizeOrder,
  createOrders: createOrders,
  deleteOrdersByIds: deleteOrdersByIds,
  getBuyerOrders: getBuyerOrders,
  getSellerOrders: getSellerOrders,
  getOrderById: getOrderById,
  updateOrder: updateOrder
};
