const express = require("express");
const router = express.Router();
path = require("path");
const multer = require("multer");
require('dotenv').config().parsed
const { JwtAuth, GalleryFileAuthorization } = require('../../../middleware/jwtAuth')
const imageList = require('../../model/class/utils/imageList')

// reference: https://dev.to/franciscomendes10866/upload-files-to-minio-object-storage-s3-with-expressjs-3561
const { bucket, s3, galleryStorage } = require("../../../config/minio_config");
const { notFoundError } = require("../../model/error/error");

const upload = multer({
  storage: galleryStorage,
  limits: { 
    fileSize: 1024 * 1024 * 5,
    files: 1
  },
  async fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error("Please upload a image file type jpg, jpeg or png"));
    }
    // when upload file exist cannot upload other file
    // const folder = `${mode == "development" ? "developments" : "productions"}/${req.params.endpoint}/${req.params.id}`;
    
    // // delete all file
    // await validateDeleteAllImage(cb, folder)

    cb(undefined, true);
  }
});

// read image (not found case)
router.get("/:id", async (req, res) => {
  const folder = imageList.findImagePath("contents",req.params.id);
  const fileName = `${folder}/main.png`;
  const params = { Bucket: bucket, Key: fileName };

  let file = await s3.getObject(params, function (err, data) {
    // not found case
    if (err) return res.status(404).json({ message: "File not found" });
    return res.status(200).type("image/png").send(data.Body);
  });
});

// upload single image
// condition (file size < 2 MB, file multipart, file upload per solution, file type image only, path storage property)
router.post("/:id", JwtAuth, GalleryFileAuthorization, upload.single("file"), async (req, res, next) => {
  try {
    if (req.file) {
      return res.status(201).json({ message: req.file.location });
    } else {
      notFoundError("File upload not found")
    }
  } catch (err) {
    next(err)
  }
});

// delete single image
router.delete("/:id", JwtAuth, GalleryFileAuthorization, async (req, res) => {
  const folder = imageList.findImagePath("contents", req.params.id);
  const fileName = `${folder}/main.png`;
  const params = { Bucket: bucket, Key: fileName };
  // console.log(params)

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