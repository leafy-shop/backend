const multerS3 = require("multer-s3")
const AWS = require("aws-sdk")
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

module.exports.storage = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: async (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    cb(null, `${mode == "development" ? "developments" : "productions"}/${req.params.endpoint}/${req.params.id}/${file.originalname}`);
  }
});