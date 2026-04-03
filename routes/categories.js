var express = require('express');
var categoryController = require('../controllers/categories');
var authHandler = require('../utils/authHandler');
var uploadHandler = require('../utils/uploadHandler');
var titleHandler = require('../utils/titleHandler');

var router = express.Router();

router.get('/', async function (req, res, next) {
  try {
    var categories = await categoryController.getAllCategories({ isDeleted: false });

    return res.json({
      total: categories.length,
      categories: categories.map(categoryController.sanitizeCategory)
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async function (req, res, next) {
  try {
    var category = await categoryController.getCategoryById(req.params.id);

    if (!category) {
      return res.status(404).json({
        message: 'category not found'
      });
    }

    return res.json({
      category: categoryController.sanitizeCategory(category)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'category not found'
      });
    }

    return next(error);
  }
});

router.post(
  '/',
  authHandler.protect,
  authHandler.restrictTo('Admin'),
  uploadHandler.uploadSingleImage('image'),
  async function (req, res, next) {
    try {
      var body = req.body || {};
      var name = body.name ? String(body.name).trim() : '';
      var description = body.description ? String(body.description).trim() : '';
      var image = body.image ? String(body.image).trim() : '';

      if (!name) {
        return res.status(400).json({
          message: 'name is required'
        });
      }

      if (req.file) {
        var uploadedImages = await uploadHandler.persistUploadedFiles([req.file], 'categories');
        image = uploadedImages[0];
      }

      var slug = titleHandler.convertToSlug(name);
      var existingCategory = await categoryController.getCategoryBySlug(slug, { includeDeleted: true });

      if (existingCategory) {
        return res.status(409).json({
          message: 'category already exists'
        });
      }

      var category = await categoryController.createCategory({
        name: name,
        slug: slug,
        description: description,
        image: image
      });

      return res.status(201).json({
        message: 'category created successfully',
        category: categoryController.sanitizeCategory(category)
      });
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(409).json({
          message: 'category already exists'
        });
      }

      if (error && error.name === 'ValidationError') {
        return res.status(400).json({
          message: error.message
        });
      }

      return next(error);
    }
  }
);

async function updateCategoryHandler(req, res, next) {
  try {
    var category = await categoryController.getCategoryById(req.params.id);

    if (!category) {
      return res.status(404).json({
        message: 'category not found'
      });
    }

    var body = req.body || {};
    var updatePayload = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      updatePayload.name = body.name.trim();
      updatePayload.slug = titleHandler.convertToSlug(body.name);
    }

    if (typeof body.description === 'string') {
      updatePayload.description = body.description.trim();
    }

    if (typeof body.image === 'string') {
      updatePayload.image = body.image.trim();
    }

    if (req.file) {
      var uploadedImages = await uploadHandler.persistUploadedFiles([req.file], 'categories');
      updatePayload.image = uploadedImages[0];
    }

    var updatedCategory = await categoryController.updateCategory(req.params.id, updatePayload);

    return res.json({
      message: 'category updated successfully',
      category: categoryController.sanitizeCategory(updatedCategory)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'category not found'
      });
    }

    if (error && error.code === 11000) {
      return res.status(409).json({
        message: 'category already exists'
      });
    }

    if (error && error.name === 'ValidationError') {
      return res.status(400).json({
        message: error.message
      });
    }

    return next(error);
  }
}

router.put(
  '/:id',
  authHandler.protect,
  authHandler.restrictTo('Admin'),
  uploadHandler.uploadSingleImage('image'),
  updateCategoryHandler
);

router.patch(
  '/:id',
  authHandler.protect,
  authHandler.restrictTo('Admin'),
  uploadHandler.uploadSingleImage('image'),
  updateCategoryHandler
);

router.delete('/:id', authHandler.protect, authHandler.restrictTo('Admin'), async function (req, res, next) {
  try {
    var category = await categoryController.softDeleteCategory(req.params.id);

    if (!category) {
      return res.status(404).json({
        message: 'category not found'
      });
    }

    return res.json({
      message: 'category deleted successfully',
      category: categoryController.sanitizeCategory(category)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'category not found'
      });
    }

    return next(error);
  }
});

module.exports = router;
