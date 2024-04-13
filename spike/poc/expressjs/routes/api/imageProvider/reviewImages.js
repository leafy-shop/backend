const express = require("express");
const router = express.Router();
path = require("path");
const multer = require("multer");
require('dotenv').config().parsed
const { JwtAuth, ReviewFileAuthorization } = require('../../../middleware/jwtAuth')
const imageList = require('../../model/class/utils/imageList')

const { bucket, s3, reviewStorage } = require("../../../config/minio_config");
const { deleteAllImage, findImagePath, listAllImage } = require("../../model/class/utils/imageList");

const upload = multer({
    storage: reviewStorage,
    limits: {
        fileSize: 1024 * 1024 * 1,
    },
    limits: { files: 5 },
    fileFilter(req, file, cb) {
        // filter file content type
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error("Please upload a image file type jpg, jpeg or png"));
        }
        // console.log(file)
        cb(undefined, true);
    }
});

// read image (not found case)
router.get("/:id/:filename", async (req, res) => {
    const folder = imageList.findImagePath("reviews",req.params.id);
    console.log(folder)
    const fileName = `${folder}/${req.params.filename}`;
    const params = { Bucket: bucket, Key: fileName };
  
    let file = await s3.getObject(params, function (err, data) {
      // not found case
      if (err) return res.status(404).json({ message: "File not found" });
      return res.status(200).type("image/png").send(data.Body);
    });
});

// upload multiple image
// condition (file size < 1 MB, file multipart, file upload per solution, file type image only, path storage property)
router.post("/:id", JwtAuth, ReviewFileAuthorization, async (req, res, next) => {
    // list all object when exist
    try {
        // remove image before reupload
        const folder = findImagePath("reviews", req.params.id)
        const listedObjects = await listAllImage(folder)

        if (listedObjects.length != 0) {
            // console.log(folder)

            // create mapping all images object params
            const deleteParams = {
                Bucket: bucket,
                Delete: { Objects: listedObjects.map(obj => ({ Key: folder + "/" + obj })) },
            };

            // delete all files when exist
            await s3.deleteObjects(deleteParams).promise();
        }
        next()
    } catch (err) {
        next(err)
    }
}, upload.array("file", 10), async (req, res) => {
    let locations = []
    req.files.forEach(file => {
        locations.push(file.location)
        // show all file selected when upload.
        console.log(`upload files: ${file.key}`)
    })
    return res.status(201).json({ message: locations });
});

// delete multiple image
router.delete("/:id", JwtAuth, ReviewFileAuthorization, async (req, res) => {
    const folder = findImagePath("reviews", req.params.id);
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
        console.log(params)
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
    else return res.status(404).json({ message: "There Files have already deleted" });
});

// delete all image
router.delete("/:id/all", JwtAuth, ReviewFileAuthorization, async (req, res) => {
    const folder = findImagePath("reviews", req.params.id);
    // console.log(folder)

    // delete all image
    return await deleteAllImage(res, folder)
});

module.exports = router;