var express = require('express');
var crypto = require('crypto');
var OAuth2Client = require('google-auth-library').OAuth2Client;
var userController = require('../controllers/users');
var authHandler = require('../utils/authHandler');

var router = express.Router();
var googleClient = null;

function normalizeAddresses(addresses) {
  if (!Array.isArray(addresses)) {
    return [];
  }

  return addresses.map(function (address) {
    return {
      fullName: address.fullName,
      phone: address.phone,
      street: address.street,
      ward: address.ward,
      district: address.district,
      city: address.city,
      country: address.country || 'Vietnam',
      isDefault: Boolean(address.isDefault)
    };
  });
}

function buildAuthResponse(user) {
  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    phone: user.phone,
    addresses: user.addresses,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID || '';
}

function getGoogleClient() {
  if (!getGoogleClientId()) {
    return null;
  }

  if (!googleClient) {
    googleClient = new OAuth2Client(getGoogleClientId());
  }

  return googleClient;
}

function createGooglePasswordPlaceholder() {
  return crypto.randomBytes(24).toString('hex');
}

async function verifyGoogleToken(idToken) {
  var client = getGoogleClient();

  if (!client) {
    var configError = new Error('google login is not configured');
    configError.statusCode = 500;
    throw configError;
  }

  var ticket = await client.verifyIdToken({
    idToken: idToken,
    audience: getGoogleClientId()
  });
  var payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
    var tokenError = new Error('invalid google token');
    tokenError.statusCode = 401;
    throw tokenError;
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: payload.name ? String(payload.name).trim() : String(payload.email).split('@')[0],
    avatar: payload.picture ? String(payload.picture).trim() : ''
  };
}

router.post('/register', async function (req, res, next) {
  try {
    var body = req.body || {};
    var name = body.name ? String(body.name).trim() : '';
    var email = body.email ? String(body.email).trim().toLowerCase() : '';
    var password = body.password ? String(body.password) : '';

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'name, email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'password must be at least 6 characters long'
      });
    }

    var existingUser = await userController.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        message: 'email already in use'
      });
    }

    var user = await userController.createUser({
      name: name,
      email: email,
      password: password,
      role: 'User',
      avatar: body.avatar,
      phone: body.phone,
      addresses: normalizeAddresses(body.addresses)
    });

    var token = authHandler.signToken({
      _id: user.id || user._id,
      role: user.role
    });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: authHandler.getCookieMaxAge()
    });

    return res.status(201).json({
      message: 'register successfully',
      token: token,
      user: buildAuthResponse(user)
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        message: 'email already in use'
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

router.post('/google', async function (req, res, next) {
  try {
    var body = req.body || {};
    var idToken = body.idToken || body.credential || body.token;

    if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
      return res.status(400).json({
        message: 'google idToken is required'
      });
    }

    var googleProfile = await verifyGoogleToken(idToken.trim());
    var user = await userController.findByGoogleId(googleProfile.googleId);

    if (!user) {
      user = await userController.findByEmail(googleProfile.email);
    }

    if (!user) {
      user = await userController.createUser({
        name: googleProfile.name,
        email: googleProfile.email,
        password: createGooglePasswordPlaceholder(),
        googleId: googleProfile.googleId,
        role: 'User',
        avatar: googleProfile.avatar
      });
    } else {
      if (user.isBlocked) {
        return res.status(403).json({
          message: 'your account has been blocked'
        });
      }

      if (user.googleId && String(user.googleId) !== googleProfile.googleId) {
        return res.status(409).json({
          message: 'this email is already linked to another Google account'
        });
      }

      var updatePayload = {
        googleId: googleProfile.googleId
      };

      if (!user.avatar || user.avatar === 'https://placehold.co/200x200?text=User') {
        updatePayload.avatar = googleProfile.avatar;
      }

      user = await userController.updateUserById(user.id || user._id, updatePayload);
      user = userController.sanitizeUser(user);
    }

    if (user.isBlocked) {
      return res.status(403).json({
        message: 'your account has been blocked'
      });
    }

    var token = authHandler.signToken({
      _id: user.id || user._id,
      role: user.role
    });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: authHandler.getCookieMaxAge()
    });

    return res.json({
      message: 'google login successfully',
      token: token,
      user: buildAuthResponse(user)
    });
  } catch (error) {
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message
      });
    }

    if (error && error.code === 11000) {
      return res.status(409).json({
        message: 'email already in use'
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

router.post('/login', async function (req, res, next) {
  try {
    var body = req.body || {};
    var email = body.email ? String(body.email).trim().toLowerCase() : '';
    var password = body.password ? String(body.password) : '';

    if (!email || !password) {
      return res.status(400).json({
        message: 'email and password are required'
      });
    }

    var user = await userController.findByEmail(email, true);
    if (!user) {
      return res.status(401).json({
        message: 'invalid email or password'
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        message: 'your account has been blocked'
      });
    }

    var isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'invalid email or password'
      });
    }

    var token = authHandler.signToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: authHandler.getCookieMaxAge()
    });

    return res.json({
      message: 'login successfully',
      token: token,
      user: buildAuthResponse(userController.sanitizeUser(user))
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authHandler.protect, function (req, res) {
  return res.json({
    user: buildAuthResponse(req.user)
  });
});

router.post('/logout', function (req, res) {
  res.cookie('token', '', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0
  });

  return res.json({
    message: 'logout successfully'
  });
});

module.exports = router;
