require('dotenv').config().parsed

const admin = require('firebase-admin')
const serviceAccount = require('./firestore_config')
const FirebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
})
const storage = FirebaseApp.storage();
const bucket = storage.bucket();

module.exports.bucket = bucket
module.exports.mode = process.env.NODE_ENV