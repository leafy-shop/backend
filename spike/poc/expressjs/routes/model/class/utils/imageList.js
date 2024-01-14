const storage = require("./../../../../config/minio_config");

// require('dotenv').config().parsed

let findImagePath = (endpoint, id, subpath = undefined) => {
    let mode = storage.mode
    let path = `${mode == "development" ? "developments" : "productions"}/${endpoint}/${id}`
    path = subpath !== undefined ? `${path}/${subpath}` : path
    return path;
}

let listAllImage = async (folder, subpath = 3) => {
    let s3 = storage.s3
    let bucket = storage.bucket
    // create list path
    const listObjectsParams = {
        Bucket: bucket,
        Prefix: folder
    };

    try {
        // list all object when exist
        const listedObjects = await s3.listObjectsV2(listObjectsParams).promise();
        // console.log(listedObjects)
        
        // complexity O(n^3)
        return listedObjects.Contents.filter(obj => {
            // obj.Key.replace(/^.*[\\/]/, '')
            return obj.Key.split("/").splice(subpath).length === 1
        }).map(obj => obj.Key.replace(/^.*[\\/]/, '')); // get only file name
    } catch (err) {
        return undefined
    }
}

let listFirstImage = async (folder) => {
    try {
        // console.log("T")
        // list all object when exist
        const listedObjects = await listAllImage(folder);
        return listedObjects[0]
    } catch (err) {
        return undefined
    }
}

let getAllStyleImageItem = async (folder) => {
    try {
        // list all style object when
        const listedObjects = await listAllImage(folder, 4);
        console.log(listedObjects)
        return listedObjects
    } catch (err) {
        return undefined
    }
}

let validateDeleteAllImage = async (cb, folder) => {
    let s3 = storage.s3
    let bucket = storage.bucket
    try {
        // list all object when exist
        const listedObjects = await listAllImage(folder,3)

        if (listedObjects.length != 0) {

            // create mapping all images object params
            const deleteParams = {
                Bucket: bucket,
                Delete: { Objects: listedObjects.map(obj => ({ Key: folder + "/" + obj })) },
            };

            // delete all files when exist
            await s3.deleteObjects(deleteParams).promise();
        }
        return listedObjects.length;
    } catch (err) {
        return cb(new Error("Could not delete file"));
    }
}

let deleteAllImage = async (res, folder) => {
    let s3 = storage.s3
    let bucket = storage.bucket
    try {
        // list all object when exist
        const listedObjects = await listAllImage(folder)
        if (listedObjects.length != 0) {
            // console.log(folder)

            // create mapping all images object params
            const deleteParams = {
                Bucket: bucket,
                Delete: { Objects: listedObjects.map(obj => ({ Key: folder + "/" + obj })) },
            };

            console.log(listedObjects)
            // delete all files when exist
            await s3.deleteObjects(deleteParams).promise();
        }
        return res.json({ message: `Deleted ${listedObjects.length} files in path ${folder}` });
    } catch (err) {
        return res.status(500).json({ message: "Could not delete file" });
    }
}

module.exports.listAllImage = listAllImage;
module.exports.findImagePath = findImagePath;
module.exports.listFirstImage = listFirstImage;
module.exports.getAllStyleImageItem = getAllStyleImageItem
module.exports.deleteAllImage = deleteAllImage;
module.exports.validateDeleteAllImage = validateDeleteAllImage;