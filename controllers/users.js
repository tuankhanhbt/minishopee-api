var User = require('../schemas/users');

function sanitizeUser(userDocument) {
  if (!userDocument) {
    return null;
  }

  var user = userDocument.toObject ? userDocument.toObject() : { ...userDocument };
  user.id = String(user._id || user.id || '');
  delete user._id;
  delete user.password;
  delete user.__v;
  return user;
}

async function createUser(payload) {
  var user = new User(payload);
  await user.save();
  return sanitizeUser(user);
}

async function findByEmail(email, includePassword) {
  var query = User.findOne({ email: email.toLowerCase() });

  if (includePassword) {
    query = query.select('+password');
  }

  return query;
}

async function findById(id) {
  return User.findById(id);
}

async function findByGoogleId(googleId) {
  return User.findOne({ googleId: googleId });
}

async function getAllUsers() {
  return User.find({});
}

async function updateUserById(id, payload) {
  var user = await User.findById(id);

  if (!user) {
    return null;
  }

  Object.keys(payload || {}).forEach(function (key) {
    user.set(key, payload[key]);
  });

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'addresses')) {
    user.markModified('addresses');
  }

  await user.save();
  return user;
}

module.exports = {
  createUser: createUser,
  findByEmail: findByEmail,
  findById: findById,
  findByGoogleId: findByGoogleId,
  getAllUsers: getAllUsers,
  updateUserById: updateUserById,
  sanitizeUser: sanitizeUser
};
