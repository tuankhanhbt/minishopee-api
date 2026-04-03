var jwt = require('jsonwebtoken');
var userController = require('../controllers/users');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'minishop-secret-key';
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '7d';
}

function getCookieMaxAge() {
  return 7 * 24 * 60 * 60 * 1000;
}

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    getJwtSecret(),
    {
      expiresIn: getJwtExpiresIn()
    }
  );
}

function extractToken(req) {
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }

  return null;
}

async function protect(req, res, next) {
  try {
    var token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        message: 'you are not logged in'
      });
    }

    var decoded = jwt.verify(token, getJwtSecret());
    var user = await userController.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: 'the user belonging to this token no longer exists'
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        message: 'your account has been blocked'
      });
    }

    req.userId = user._id;
    req.user = userController.sanitizeUser(user);
    return next();
  } catch (error) {
    return res.status(401).json({
      message: 'invalid or expired token'
    });
  }
}

function restrictTo() {
  var roles = Array.prototype.slice.call(arguments);

  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'you do not have permission to perform this action'
      });
    }

    return next();
  };
}

module.exports = {
  signToken: signToken,
  protect: protect,
  restrictTo: restrictTo,
  getCookieMaxAge: getCookieMaxAge
};
