var Product = require('../schemas/products');

function sanitizeProduct(productDocument) {
  if (!productDocument) {
    return null;
  }

  var product = productDocument.toObject ? productDocument.toObject() : { ...productDocument };
  delete product.__v;
  return product;
}

function withProductPopulation(query) {
  return query
    .populate('sellerId', 'name email avatar role')
    .populate('categoryId', 'name slug image');
}

async function createProduct(payload) {
  var product = new Product(payload);
  await product.save();
  return withProductPopulation(Product.findById(product._id));
}

async function getProductById(id, options) {
  var filter = { _id: id };

  if (!options || !options.includeDeleted) {
    filter.isDeleted = false;
  }

  return withProductPopulation(Product.findOne(filter));
}

async function getProducts(filter, options) {
  var query = Product.find(filter || {})
    .sort((options && options.sort) || { createdAt: -1 })
    .skip((options && options.skip) || 0)
    .limit((options && options.limit) || 10);

  return withProductPopulation(query);
}

async function countProducts(filter) {
  return Product.countDocuments(filter || {});
}

async function getSellerProducts(sellerId) {
  return withProductPopulation(
    Product.find({
      sellerId: sellerId,
      isDeleted: false
    }).sort({ createdAt: -1 })
  );
}

async function updateProduct(id, payload) {
  return withProductPopulation(
    Product.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    })
  );
}

async function reserveStock(productId, quantity) {
  return Product.findOneAndUpdate(
    {
      _id: productId,
      isDeleted: false,
      isPublished: true,
      stock: {
        $gte: quantity
      }
    },
    {
      $inc: {
        stock: -quantity
      }
    },
    {
      new: true
    }
  );
}

async function restoreStocks(items) {
  if (!Array.isArray(items) || !items.length) {
    return;
  }

  for (var index = 0; index < items.length; index += 1) {
    var item = items[index];

    if (!item || !item.productId || !item.quantity) {
      continue;
    }

    await Product.findByIdAndUpdate(item.productId, {
      $inc: {
        stock: Number(item.quantity)
      }
    });
  }
}

async function setProductRatings(productId, ratingsAverage, ratingsQuantity) {
  return Product.findByIdAndUpdate(
    productId,
    {
      ratingsAverage: ratingsAverage,
      ratingsQuantity: ratingsQuantity
    },
    {
      new: true
    }
  );
}

async function softDeleteProduct(id) {
  return withProductPopulation(
    Product.findByIdAndUpdate(
      id,
      { isDeleted: true },
      {
        new: true
      }
    )
  );
}

module.exports = {
  createProduct: createProduct,
  getProductById: getProductById,
  getProducts: getProducts,
  countProducts: countProducts,
  getSellerProducts: getSellerProducts,
  updateProduct: updateProduct,
  reserveStock: reserveStock,
  restoreStocks: restoreStocks,
  setProductRatings: setProductRatings,
  softDeleteProduct: softDeleteProduct,
  sanitizeProduct: sanitizeProduct
};
