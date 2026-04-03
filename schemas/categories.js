var mongoose = require('mongoose');

var categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      unique: true
    },
    slug: {
      type: String,
      required: [true, 'slug is required'],
      trim: true,
      unique: true
    },
    image: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Category', categorySchema);
