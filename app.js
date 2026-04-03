var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');

require('dotenv').config();

var indexRouter = require('./routes/index');
var authRouter = require('./routes/auth');
var usersRouter = require('./routes/users');
var categoriesRouter = require('./routes/categories');
var productsRouter = require('./routes/products');
var cartRouter = require('./routes/cart');
var ordersRouter = require('./routes/orders');
var reviewsRouter = require('./routes/reviews');

var app = express();

var mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/minishop';

mongoose
  .connect(mongoUri)
  .then(function () {
    console.log('MongoDB connected');
  })
  .catch(function (error) {
    console.error('MongoDB connection error:', error.message);
  });

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/categories', categoriesRouter);
app.use('/products', productsRouter);
app.use('/cart', cartRouter);
app.use('/orders', ordersRouter);
app.use('/reviews', reviewsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message || 'internal server error'
  });
});

module.exports = app;
