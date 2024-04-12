const multerS3 = require("multer-s3")
const AWS = require("aws-sdk")
const fs = require("../routes/model/class/utils/imageList")

require('dotenv').config().parsed

const bucket = process.env.S3_BUCKET
const mode = process.env.NODE_ENV

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  sslEnabled: false,
  s3ForcePathStyle: true,
});

module.exports.bucket = bucket
module.exports.s3 = s3
module.exports.mode = mode

module.exports.productStorage = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: async (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    let path = fs.findImagePath("products", req.params.id)
    cb(null, `${path}/main.png`);
  }
});

module.exports.productStyleStorage = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: async (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    let path = fs.findImagePath("products", req.params.id, req.params.style)
    cb(null, `${path}/${file.originalname}`);
  }
});

module.exports.userIconStorage = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: async (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    let path = fs.findImagePath("users", req.params.id)
    cb(null, `${path}/main.png`);
  }
});

module.exports.userCoverStorage = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: async (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    let path = fs.findImagePath("users", req.params.id)
    cb(null, `${path}/cover_photo.png`);
  }
});

module.exports.galleryStorage = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: async (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    let path = fs.findImagePath("contents", req.params.id)
    cb(null, `${path}/main.png`);
  }
});


module.exports.galleryDetailStorage = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: async (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    setTimeout(() => {
      let path = fs.findImagePath("contents", req.params.id, "details")
      cb(null, `${path}/${new Date().getTime()}.png`);
    }, 1);
  }
});