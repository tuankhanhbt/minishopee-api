var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.json({
    project: 'Mini Shopee',
    stage: 'Phase 4 - Orders, Delivery, Reviews',
    status: 'ready',
    endpoints: {
      health: 'GET /',
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      googleLogin: 'POST /auth/google',
      logout: 'POST /auth/logout',
      me: 'GET /auth/me',
      usersMe: 'GET /users/me',
      adminUsers: 'GET /users',
      categories: 'GET /categories',
      createCategory: 'POST /categories',
      products: 'GET /products',
      createProduct: 'POST /products',
      myProducts: 'GET /products/my-products',
      cart: 'GET /cart',
      addToCart: 'POST /cart/items',
      checkout: 'POST /orders/checkout',
      myOrders: 'GET /orders/my-orders',
      mySales: 'GET /orders/my-sales',
      orderDetail: 'GET /orders/:id',
      updateOrderStatus: 'PATCH /orders/:id/status',
      receiveOrder: 'PATCH /orders/:id/receive',
      cancelOrder: 'PATCH /orders/:id/cancel',
      productReviews: 'GET /reviews/product/:productId',
      createReview: 'POST /reviews'
    }
  });
});

module.exports = router;
