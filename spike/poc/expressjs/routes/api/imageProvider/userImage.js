const express = require("express");
const router = express.Router();
path = require("path");
const multer = require("multer");
require('dotenv').config().parsed
const { JwtAuth, verifyRole, UserFileAuthorization } = require('../../../middleware/jwtAuth')
const { ROLE } = require("../../model/enum/role");
const imageList = require('../../model/class/utils/imageList')

// reference: https://dev.to/franciscomendes10866/upload-files-to-minio-object-storage-s3-with-expressjs-3561
const { bucket, s3, mode, userIconStorage, userCoverStorage } = require("../../../config/minio_config");
const { notFoundError } = require("../../model/error/error");

const uploadIcon = multer({
    storage: userIconStorage,
    limits: {
        fileSize: 1024 * 1024 * 1,
        files: 1
    },
    async fileFilter(req, file, cb) {
        console.log(file)
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error("Please upload a image file type jpg, jpeg or png"));
        }
        cb(undefined, true);
    }
});

const uploadCover = multer({
    storage: userCoverStorage,
    limits: { 
        fileSize: 1024 * 1024 * 2,
        files: 1 
    },
    async fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error("Please upload a image file type jpg, jpeg or png"));
        }
        cb(undefined, true);
    }
});

// ----------------------- user icon -------------------------------
// read image (not found case)
router.get("/:id", async (req, res) => {
    const folder = imageList.findImagePath("users", req.params.id);
    const fileName = `${folder}/main.png`;
    const params = { Bucket: bucket, Key: fileName };

    let file = await s3.getObject(params, function (err, data) {
        // not found case
        if (err) return res.status(404).json({ message: "File not found" });
        return res.status(200).type("image/png").send(data.Body);
    });
});

// upload single image
// condition (file size < 1 MB, file multipart, file upload per solution, file type image only, path storage property)
router.post("/:id", JwtAuth, UserFileAuthorization, uploadIcon.single("file"), async (req, res, next) => {
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
router.delete("/:id", JwtAuth, UserFileAuthorization, async (req, res) => {
    const folder = imageList.findImagePath("users", req.params.id);
    const fileName = `${folder}/main.png`;
    console.log(fileName)
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

// ----------------------- cover photo -------------------------------
router.get("/:id/coverphoto", async (req, res) => {
    const folder = imageList.findImagePath("users", req.params.id);
    const fileName = `${folder}/cover_photo.png`;
    const params = { Bucket: bucket, Key: fileName };

    let file = await s3.getObject(params, function (err, data) {
        // not found case
        if (err) return res.status(404).json({ message: "File not found" });
        return res.status(200).type("image/png").send(data.Body);
    });
});

// upload single image
// condition (file size < 2 MB, file multipart, file upload per solution, file type image only, path storage property)
router.post("/:id/coverphoto", JwtAuth, UserFileAuthorization, uploadCover.single("file"), async (req, res, next) => {
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
router.delete("/:id/coverphoto", JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), UserFileAuthorization, async (req, res) => {
    const folder = imageList.findImagePath("users", req.params.id);
    const fileName = `${folder}/cover_photo.png`;
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