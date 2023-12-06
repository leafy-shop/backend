const { bucket, s3, mode } = require("./../../../../config/minio_config");

let findImagePath = (endpoint, id) => {
    return `${mode == "development" ? "developments" : "productions"}/${endpoint}/${id}`;
}

let listAllImage = async (res, folder) => {
    // create list path
    const listObjectsParams = {
        Bucket: bucket,
        Prefix: folder
    };

    try {
        // list all object when exist
        const listedObjects = await s3.listObjectsV2(listObjectsParams).promise();
        return listedObjects.Contents.map(obj => obj.Key.replace(/^.*[\\/]/, '')); // get only file name
    } catch (err) {
        return undefined
    }
}

let listFirstImage = async (res, folder) => {
    try {
        // list all object when exist
        const listedObjects = await listAllImage(res, folder)
        return listedObjects[0] // get only first file name
    } catch (err) {
        return undefined
    }
}

let validateDeleteAllImage = async (cb, folder) => {
    try {
        // list all object when exist
        const listedObjects = await listAllImage(folder)
        if (listedObjects.length != 0) {

            // create mapping all images object params
            const deleteParams = {
                Bucket: bucket,
                Delete: { Objects: listedObjects.map(obj => ({ Key: folder+obj })) },
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
    try {
        // list all object when exist
        const listedObjects = await listAllImage(folder)
        if (listedObjects.length != 0) {

            // create mapping all images object params
            const deleteParams = {
                Bucket: bucket,
                Delete: { Objects: listedObjects.map(obj => ({ Key: folder+obj })) },
            };

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
module.exports.deleteAllImage = deleteAllImage;
module.exports.validateDeleteAllImage = validateDeleteAllImage;