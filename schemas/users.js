var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

var addressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    street: {
      type: String,
      trim: true,
      default: ''
    },
    ward: {
      type: String,
      trim: true,
      default: ''
    },
    district: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    country: {
      type: String,
      trim: true,
      default: 'Vietnam'
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    _id: false
  }
);

var userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'invalid email format']
    },
    password: {
      type: String,
      required: [true, 'password is required'],
      minlength: 6,
      select: false
    },
    googleId: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ['User', 'Admin'],
      default: 'User'
    },
    avatar: {
      type: String,
      default: 'https://placehold.co/200x200?text=User'
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    addresses: {
      type: [addressSchema],
      default: []
    },
    isBlocked: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
