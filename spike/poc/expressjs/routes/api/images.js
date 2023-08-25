const express = require("express");
const router = express.Router();
path = require("path");
const multer = require("multer");

// const fs = require('fs')
const { bucket, mode } = require("../../config/firestore_implement");
const { errorRes } = require("../model/error/error");

// allow multipart file
// const multerStorage = multer.diskStorage({
//     destination: function (req, file, callback) {
//         let path = `./assets/images/${req.params.endpoint}`
//         if (req.params.endpoint == 'solutions') {
//             path = path + `/${req.params.id}`
//         }
//         fs.mkdirSync(path, { recursive: true })
//         callback(null, path);
//     },
//     filename: function (req, file, cb) {
//         if (req.params.endpoint == 'solutions') {
//             cb(null, `${req.query.step}.png`);
//         } else {
//             cb(null, `${req.params.id}.png`);
//         }
//     }
// })

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 10,
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error("Please upload a image file type jpg, jpeg or png"));
        }
        cb(undefined, true);
    },
});

// read solution image (not found case)
router.get("/:endpoint/:name", async (req, res) => {
    // let pathed = `/../../assets/images/${req.params.endpoint}/${req.params.id}`
    // res.sendFile(path.resolve(__dirname + pathed + (req.query.step != undefined ? `/${req.query.step}.png` : '.png')),
    //     err => {
    //         next(errorModel("File not found!!", req.originalUrl))
    //     });
    console.log(mode);
    const folder = `images/${mode == "development" ? "developments" : "productions"
        }/${req.params.endpoint}`;
    const fileName = `${folder}/${req.params.name}`;
    const file = bucket.file(fileName);
    file.download().then(
        (downloadResponse) => {
            return res.status(200).type("image/png").send(downloadResponse[0]);
        },
        (err) => {
            console.log(err)
            return res.status(404).json(errorRes("File not found!!",req.originalUrl))
        }
    );
});

// upload solution image
// condition (file size < 10 MB, file multipart, file upload per solution, file type image only, path storage property)
router.post("/:endpoint/:id", upload.single("file"), async (req, res) => {
    if (req.params.id == "undefined" || req.params.endpoint == "undefined") {
        notFoundError("upload file is blocked");
    }
    // getUpload(req, res, err => {

    //     if (err) {
    //         return res.status(400).send(errorModel(err.message, req.originalUrl));
    //     }
    //     // Everything went fine.
    //     res.status(201).send(req.file)
    // })
    console.log(req.file)
    const folder = `images/${mode == "development" ? "developments" : "productions"}/${req.params.endpoint}`;
    const fileName = `${folder}/${req.params.id}/${req.file.originalname}`;
    const fileUpload = bucket.file(fileName);
    const blobStream = fileUpload.createWriteStream({
        metadata: {
            contentType: req.file.mimetype
        },
    });
    blobStream.on("error", (err) => {
        res.status(400).json(err);
    });
    blobStream.on("finish", () => {
        res.status(201).json({ message: "Upload complete!" });
    });
    blobStream.end(req.file.buffer);
});

// delete solution image
router.delete("/:endpoint/:id", async (req, res) => {
    // let pathed = `/../../assets/images/${req.params.endpoint}/${req.params.id}`
    // fs.unlink(__dirname + pathed + (req.query.step != undefined ? `/${req.query.step}.png` : '.png'), (err) => {
    //     if (err) {
    //         return res.status(404).send(errorModel("File not found", req.originalUrl));
    //     }
    //     res.send({ message: "file has been deleted" })
    // })

    const folder = `images/${mode == "development" ? "developments" : "productions"}/${req.params.endpoint}`;
    const directory = `${folder}/${req.params.id}/`;
    bucket.deleteFiles({
        prefix: directory,
    });
    return res.status(200).json({ message: "Delete complete!" });
});

module.exports = router;