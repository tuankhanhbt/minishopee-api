var express = require('express');
var userController = require('../controllers/users');
var authHandler = require('../utils/authHandler');

var router = express.Router();

function normalizeAddresses(addresses) {
  if (!Array.isArray(addresses)) {
    return [];
  }

  return addresses.map(function (address) {
    return {
      fullName: address.fullName ? String(address.fullName).trim() : '',
      phone: address.phone ? String(address.phone).trim() : '',
      street: address.street ? String(address.street).trim() : '',
      ward: address.ward ? String(address.ward).trim() : '',
      district: address.district ? String(address.district).trim() : '',
      city: address.city ? String(address.city).trim() : '',
      country: address.country ? String(address.country).trim() : 'Vietnam',
      isDefault: Boolean(address.isDefault)
    };
  });
}

router.get('/me', authHandler.protect, function (req, res) {
  res.json({
    user: req.user
  });
});

router.patch('/me', authHandler.protect, async function (req, res, next) {
  try {
    var body = req.body || {};
    var updatePayload = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      updatePayload.name = body.name.trim();
    }

    if (typeof body.phone === 'string') {
      updatePayload.phone = body.phone.trim();
    }

    if (typeof body.avatar === 'string') {
      updatePayload.avatar = body.avatar.trim();
    }

    if (Array.isArray(body.addresses)) {
      updatePayload.addresses = normalizeAddresses(body.addresses).map(function (address, index, allAddresses) {
        return {
          ...address,
          isDefault: address.isDefault || (allAddresses.length > 0 && index === 0 && !allAddresses.some(function (item) {
            return item.isDefault;
          }))
        };
      });
    }

    var updatedUser = await userController.updateUserById(req.userId, updatePayload);

    return res.json({
      message: 'user updated successfully',
      user: userController.sanitizeUser(updatedUser)
    });
  } catch (error) {
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({
        message: error.message
      });
    }

    return next(error);
  }
});

router.get('/', authHandler.protect, authHandler.restrictTo('Admin'), async function (req, res, next) {
  try {
    var users = await userController.getAllUsers();
    res.json({
      users: users.map(userController.sanitizeUser)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
