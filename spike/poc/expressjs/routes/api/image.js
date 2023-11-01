const express = require("express");
const router = express.Router();
path = require("path");
const multer = require("multer");
const sharp = require("sharp")
require('dotenv').config().parsed
const { JwtAuth } = require('./../../middleware/jwtAuth')

// reference: https://dev.to/franciscomendes10866/upload-files-to-minio-object-storage-s3-with-expressjs-3561
const { bucket, s3, storage, mode } = require("../../config/minio_config")

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 10,
  },
  limits: { files: 1 },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error("Please upload a image file type jpg, jpeg or png"));
    }
    cb(undefined, true);
  }
});

// read image (not found case)
router.get("/:endpoint/:id/:filename", async (req, res) => {
  const folder = `${mode == "development" ? "developments" : "productions"
    }/${req.params.endpoint}/${req.params.id}`;
  const fileName = `${folder}/${req.params.filename}`;
  const params = { Bucket: bucket, Key: fileName };

  let file = await s3.getObject(params, function (err, data) {
    // not found case
    if (err) return res.status(404).json({ message: "File not found" });
    return res.status(200).type("image/png").send(data.Body);
  });
});

// upload single image
// condition (file size < 8 MB, file multipart, file upload per solution, file type image only, path storage property)
router.post("/:endpoint/:id", JwtAuth, upload.single("file"), async (req, res) => {
  return res.status(201).json({ message: req.file.location });
});

// delete single image
router.delete("/:endpoint/:id/:filename", JwtAuth, async (req, res) => {
  const folder = `${mode == "development" ? "developments" : "productions"}/${req.params.endpoint}`;
  const fileName = `${folder}/${req.params.id}/${req.params.filename}`;
  const params = { Bucket: bucket, Key: fileName };

  let file

  try {
    file = await s3.headObject(params).promise();
  } catch (error) {
    return res.status(404).json({ message: "File not found" });
  }

  if (file) {
    try {
      await s3.deleteObject(params).promise();
    } catch (error) {
      return res.status(500).json({ message: "Could not delete file" });
    }
  }

  return res.json({ message: "File deleted" });
});

module.exports = router;