var Category = require('../schemas/categories');

function sanitizeCategory(categoryDocument) {
  if (!categoryDocument) {
    return null;
  }

  var category = categoryDocument.toObject ? categoryDocument.toObject() : { ...categoryDocument };
  delete category.__v;
  return category;
}

async function createCategory(payload) {
  var category = new Category(payload);
  await category.save();
  return category;
}

async function getAllCategories(filter) {
  return Category.find(filter || {}).sort({ createdAt: -1 });
}

async function getCategoryById(id, options) {
  var filter = { _id: id };

  if (!options || !options.includeDeleted) {
    filter.isDeleted = false;
  }

  return Category.findOne(filter);
}

async function getCategoryBySlug(slug, options) {
  var filter = { slug: slug };

  if (!options || !options.includeDeleted) {
    filter.isDeleted = false;
  }

  return Category.findOne(filter);
}

async function updateCategory(id, payload) {
  return Category.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  });
}

async function softDeleteCategory(id) {
  return Category.findByIdAndUpdate(
    id,
    { isDeleted: true },
    {
      new: true
    }
  );
}

module.exports = {
  createCategory: createCategory,
  getAllCategories: getAllCategories,
  getCategoryById: getCategoryById,
  getCategoryBySlug: getCategoryBySlug,
  updateCategory: updateCategory,
  softDeleteCategory: softDeleteCategory,
  sanitizeCategory: sanitizeCategory
};
