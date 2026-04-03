var fs = require('fs');
var path = require('path');
var multer = require('multer');
var crypto = require('crypto');
var S3Client = require('@aws-sdk/client-s3').S3Client;
var PutObjectCommand = require('@aws-sdk/client-s3').PutObjectCommand;

var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }

    return cb(new Error('only image files are allowed'));
  }
});

function buildFileName(file) {
  var extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  return Date.now() + '-' + crypto.randomBytes(8).toString('hex') + extension;
}

function getS3Client() {
  if (
    !process.env.AWS_REGION ||
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    !process.env.AWS_BUCKET_NAME
  ) {
    return null;
  }

  return new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
}

async function uploadToLocal(file, folder) {
  var fileName = buildFileName(file);
  var directory = path.join(__dirname, '..', 'uploads', folder);
  var filePath = path.join(directory, fileName);

  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(filePath, file.buffer);

  return '/uploads/' + folder + '/' + fileName;
}

async function uploadToS3(file, folder, client) {
  var fileName = buildFileName(file);
  var key = folder + '/' + fileName;

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    })
  );

  return (
    'https://' +
    process.env.AWS_BUCKET_NAME +
    '.s3.' +
    process.env.AWS_REGION +
    '.amazonaws.com/' +
    key
  );
}

async function persistUploadedFiles(files, folder) {
  if (!files || !files.length) {
    return [];
  }

  var client = getS3Client();
  var fileUrls = [];

  for (var index = 0; index < files.length; index += 1) {
    if (client) {
      fileUrls.push(await uploadToS3(files[index], folder, client));
    } else {
      fileUrls.push(await uploadToLocal(files[index], folder));
    }
  }

  return fileUrls;
}

function isLocalUploadUrl(fileUrl) {
  return typeof fileUrl === 'string' && fileUrl.startsWith('/uploads/');
}

function resolveLocalUploadPath(fileUrl) {
  if (!isLocalUploadUrl(fileUrl)) {
    return null;
  }

  var relativePath = fileUrl.replace(/^\/+/, '').split('/').join(path.sep);
  return path.join(__dirname, '..', relativePath);
}

async function removeStoredFiles(fileUrls) {
  if (!Array.isArray(fileUrls) || !fileUrls.length) {
    return;
  }

  for (var index = 0; index < fileUrls.length; index += 1) {
    var filePath = resolveLocalUploadPath(fileUrls[index]);

    if (!filePath) {
      continue;
    }

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

module.exports = {
  uploadSingleImage: function (fieldName) {
    return upload.single(fieldName);
  },
  uploadMultipleImages: function (fieldName, maxCount) {
    return upload.array(fieldName, maxCount || 5);
  },
  persistUploadedFiles: persistUploadedFiles,
  removeStoredFiles: removeStoredFiles
};
