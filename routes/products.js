var express = require('express');
var productController = require('../controllers/products');
var categoryController = require('../controllers/categories');
var authHandler = require('../utils/authHandler');
var uploadHandler = require('../utils/uploadHandler');
var titleHandler = require('../utils/titleHandler');

var router = express.Router();

function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  var parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseImagesInput(images) {
  if (!images) {
    return [];
  }

  if (Array.isArray(images)) {
    return images.filter(Boolean);
  }

  if (typeof images === 'string') {
    var trimmed = images.trim();

    if (!trimmed) {
      return [];
    }

    try {
      var parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch (error) {
      return trimmed
        .split(',')
        .map(function (image) {
          return image.trim();
        })
        .filter(Boolean);
    }
  }

  return [];
}

function getPagination(query) {
  var page = Math.max(parseInt(query.page || '1', 10), 1);
  var limit = Math.min(Math.max(parseInt(query.limit || '10', 10), 1), 50);

  return {
    page: page,
    limit: limit,
    skip: (page - 1) * limit
  };
}

function getSort(query) {
  switch (query.sort) {
    case 'price_asc':
      return { price: 1 };
    case 'price_desc':
      return { price: -1 };
    case 'rating_desc':
      return { ratingsAverage: -1, createdAt: -1 };
    case 'oldest':
      return { createdAt: 1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
}

function canManageProduct(product, user) {
  return String(product.sellerId._id || product.sellerId) === String(user._id || user.id || user) || user.role === 'Admin';
}

router.get('/', async function (req, res, next) {
  try {
    var filter = {
      isDeleted: false,
      isPublished: true
    };
    var priceFilter = {};

    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      var keyword = req.query.q.trim();
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } }
      ];
    }

    if (typeof req.query.categoryId === 'string' && req.query.categoryId.trim()) {
      filter.categoryId = req.query.categoryId.trim();
    }

    if (typeof req.query.sellerId === 'string' && req.query.sellerId.trim()) {
      filter.sellerId = req.query.sellerId.trim();
    }

    var minPrice = parseNumber(req.query.minPrice);
    var maxPrice = parseNumber(req.query.maxPrice);

    if (minPrice !== null) {
      priceFilter.$gte = minPrice;
    }

    if (maxPrice !== null) {
      priceFilter.$lte = maxPrice;
    }

    if (Object.keys(priceFilter).length > 0) {
      filter.price = priceFilter;
    }

    var pagination = getPagination(req.query);
    var total = await productController.countProducts(filter);
    var products = await productController.getProducts(filter, {
      sort: getSort(req.query),
      skip: pagination.skip,
      limit: pagination.limit
    });

    return res.json({
      total: total,
      page: pagination.page,
      totalPages: Math.max(Math.ceil(total / pagination.limit), 1),
      limit: pagination.limit,
      products: products.map(productController.sanitizeProduct)
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/my-products', authHandler.protect, async function (req, res, next) {
  try {
    var products = await productController.getSellerProducts(req.userId);

    return res.json({
      total: products.length,
      products: products.map(productController.sanitizeProduct)
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async function (req, res, next) {
  try {
    var product = await productController.getProductById(req.params.id);

    if (!product || !product.isPublished) {
      return res.status(404).json({
        message: 'product not found'
      });
    }

    return res.json({
      product: productController.sanitizeProduct(product)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'product not found'
      });
    }

    return next(error);
  }
});

router.post(
  '/',
  authHandler.protect,
  uploadHandler.uploadMultipleImages('images', 5),
  async function (req, res, next) {
    var uploadedImages = [];

    try {
      var body = req.body || {};
      var name = body.name ? String(body.name).trim() : '';
      var description = body.description ? String(body.description).trim() : '';
      var categoryId = body.categoryId ? String(body.categoryId).trim() : '';
      var price = parseNumber(body.price);
      var stock = parseNumber(body.stock);
      var images = parseImagesInput(body.images);

      if (!name || !categoryId || price === null || stock === null) {
        return res.status(400).json({
          message: 'name, categoryId, price and stock are required'
        });
      }

      if (price < 0 || stock < 0) {
        return res.status(400).json({
          message: 'price and stock must be greater than or equal to 0'
        });
      }

      var category = await categoryController.getCategoryById(categoryId);
      if (!category) {
        return res.status(404).json({
          message: 'category not found'
        });
      }

      if (req.files && req.files.length) {
        uploadedImages = await uploadHandler.persistUploadedFiles(req.files, 'products');
        images = images.concat(uploadedImages);
      }

      var product = await productController.createProduct({
        sellerId: req.userId,
        categoryId: categoryId,
        name: name,
        slug: titleHandler.convertToSlug(name),
        description: description,
        price: price,
        stock: stock,
        images: images,
        isPublished: body.isPublished === undefined ? true : body.isPublished !== 'false'
      });

      return res.status(201).json({
        message: 'product created successfully',
        product: productController.sanitizeProduct(product)
      });
    } catch (error) {
      if (error && error.name === 'ValidationError') {
        return res.status(400).json({
          message: error.message
        });
      }

      if (uploadedImages.length) {
        await uploadHandler.removeStoredFiles(uploadedImages);
      }

      return next(error);
    }
  }
);

async function updateProductHandler(req, res, next) {
  var previousImages = [];
  var uploadedImages = [];

  try {
    var product = await productController.getProductById(req.params.id, { includeDeleted: true });

    if (!product) {
      return res.status(404).json({
        message: 'product not found'
      });
    }

    if (!canManageProduct(product, req.user)) {
      return res.status(403).json({
        message: 'you do not have permission to perform this action'
      });
    }

    previousImages = Array.isArray(product.images) ? product.images.slice() : [];

    var body = req.body || {};
    var updatePayload = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      updatePayload.name = body.name.trim();
      updatePayload.slug = titleHandler.convertToSlug(body.name);
    }

    if (typeof body.description === 'string') {
      updatePayload.description = body.description.trim();
    }

    if (body.categoryId) {
      var category = await categoryController.getCategoryById(String(body.categoryId).trim());
      if (!category) {
        return res.status(404).json({
          message: 'category not found'
        });
      }

      updatePayload.categoryId = String(body.categoryId).trim();
    }

    if (body.price !== undefined) {
      var price = parseNumber(body.price);
      if (price === null || price < 0) {
        return res.status(400).json({
          message: 'price must be greater than or equal to 0'
        });
      }

      updatePayload.price = price;
    }

    if (body.stock !== undefined) {
      var stock = parseNumber(body.stock);
      if (stock === null || stock < 0) {
        return res.status(400).json({
          message: 'stock must be greater than or equal to 0'
        });
      }

      updatePayload.stock = stock;
    }

    if (body.isPublished !== undefined) {
      updatePayload.isPublished = body.isPublished !== 'false' && body.isPublished !== false;
    }

    if (body.images !== undefined) {
      updatePayload.images = parseImagesInput(body.images);
    }

      if (req.files && req.files.length) {
        uploadedImages = await uploadHandler.persistUploadedFiles(req.files, 'products');
        updatePayload.images = (updatePayload.images || previousImages).concat(uploadedImages);
      }

    var updatedProduct = await productController.updateProduct(req.params.id, updatePayload);

    if (uploadedImages.length) {
      await uploadHandler.removeStoredFiles(previousImages);
    }

    return res.json({
      message: 'product updated successfully',
      product: productController.sanitizeProduct(updatedProduct)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'product not found'
      });
    }

    if (error && error.name === 'ValidationError') {
      return res.status(400).json({
        message: error.message
      });
    }

    if (uploadedImages.length) {
      await uploadHandler.removeStoredFiles(uploadedImages);
    }

    return next(error);
  }
}

router.put('/:id', authHandler.protect, uploadHandler.uploadMultipleImages('images', 5), updateProductHandler);
router.patch('/:id', authHandler.protect, uploadHandler.uploadMultipleImages('images', 5), updateProductHandler);

router.delete('/:id', authHandler.protect, async function (req, res, next) {
  try {
    var product = await productController.getProductById(req.params.id, { includeDeleted: true });

    if (!product) {
      return res.status(404).json({
        message: 'product not found'
      });
    }

    if (!canManageProduct(product, req.user)) {
      return res.status(403).json({
        message: 'you do not have permission to perform this action'
      });
    }

    var deletedProduct = await productController.softDeleteProduct(req.params.id);
    await uploadHandler.removeStoredFiles(product.images);

    return res.json({
      message: 'product deleted successfully',
      product: productController.sanitizeProduct(deletedProduct)
    });
  } catch (error) {
    if (error && error.name === 'CastError') {
      return res.status(404).json({
        message: 'product not found'
      });
    }

    return next(error);
  }
});

module.exports = router;
