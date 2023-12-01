const express = require("express");
const router = express.Router();
path = require("path");
const multer = require("multer");
require('dotenv').config().parsed
const { JwtAuth, verifyRole, FileAuthorization } = require('./../../middleware/jwtAuth')

const { bucket, s3, storage, mode } = require("../../config/minio_config");
const { ROLE } = require("../model/enum/role");
const { deleteAllImage, findImagePath } = require("../model/class/utils/imageList");

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 10,
    },
    limits: { files: 10 },
    fileFilter(req, file, cb) {
        // filter file content type
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error("Please upload a image file type jpg, jpeg or png"));
        }
        cb(undefined, true);
    }
});

// upload multiple image
// condition (file size < 8 MB, file multipart, file upload per solution, file type image only, path storage property)
router.post("/:endpoint/:id", JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), FileAuthorization, upload.array("file", 10), async (req, res) => {
    let locations = []
    req.files.forEach(file => {
        locations.push(file.location)
        // show all file selected when upload.
        console.log(`upload files: ${file.key}`)
    })
    return res.status(201).json({ message: locations });
});

// delete multiple image
router.delete("/:endpoint/:id", JwtAuth, FileAuthorization, async (req, res) => {
    const folder = findImagePath(req.params.endpoint, req.params.id);
    const fileNames = req.body.files || []
    const numberFiles = []

    // // convert array of keys to objects of Key Reference by https://www.tabnine.com/code/javascript/functions/aws-sdk/S3/deleteObjects
    // const objects = fileNames.map(key => ({ Key: `${folder}/${key}` }));
    // const params = { Bucket: bucket, Delete: {Objects: objects}};
    // try {
    //     await s3.deleteObjects(params).promise();
    // } catch (error) {
    //     return res.status(500).json({ message: "Could not delete file" });
    // }

    // loop all file selected
    for (let file of fileNames) {
        filePath = `${folder}/${file}`
        const params = { Bucket: bucket, Key: filePath };
        let fileDeleted = ""
        // find object in minio, created log and keep in show status
        try {
            file = await s3.headObject(params).promise();
            fileDeleted = filePath
            numberFiles.push(file)
        } catch (error) {
        }

        if (file) {
            try {
                await s3.deleteObject(params).promise();
            } catch (error) {
                return res.status(500).json({ message: "Could not delete file" });
            }
        }

        // show all file selected when deleted.
        if (fileDeleted != "") console.log(`delete files: ${fileDeleted}`)
    }
    if (numberFiles.length > 0) return res.json({ message: "All File Selected has been deleted" })
    else return res.json({ message: "There Files have already deleted" });
});

// delete all image
router.delete("/:endpoint/:id/all", JwtAuth, FileAuthorization, async (req, res) => {
    const folder = findImagePath(req.params.endpoint, req.params.id);

    // delete all image
    return await deleteAllImage(res, folder)
});

module.exports = router;