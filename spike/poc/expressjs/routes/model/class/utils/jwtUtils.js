const dotenv = require('dotenv');
const jwt = require('jsonwebtoken')
const crypto = require('crypto-js')

// get config vars
dotenv.config();

// get token
const getToken = (user,date) => {
    // สร้าง jwt token จาก user
    return jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: date });
}

// refresh token
// const refreshToken = (result, user, date) => {
//     try {
//         // ตรวจ refresh token จาก user เพื่อไปสร้าง access token และ refresh token ใหม่
//         let user = jwt.verify(jwttoken,process.env.TOKEN_SECRET)
//     } catch (err) {
//         result = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: date });
//     }
//     return result
// }

// convert to user email
const getUser = (jwttoken, secret) => {
    let user = {}
    try {
        // ตรวจ jwt token เป็นข้อมูล user ของคนนี้ไหม
        user = jwt.verify(jwttoken, process.env.TOKEN_SECRET)
    } catch (err) {
        // throw new Error(err.message)
    }
    return user
}

// check is expired
const isExpired = (jwtrefreshtoken) => {
    let isExpired = false
    try {
        // ตรวจ jwt token ว่าหมดอายุไหม
        let user = jwt.verify(jwtrefreshtoken,process.env.TOKEN_SECRET)
    } catch (err) {
        isExpired = true
    }
    console.log(isExpired)
    return isExpired
}

const encryptInformation = (obj) => {
    return crypto.AES.encrypt(JSON.stringify({obj}), process.env.TOKEN_INFO_SECRET).toString()
}

module.exports.getToken = getToken
// module.exports.refreshToken = refreshToken
module.exports.getUser=getUser
module.exports.isExpired = isExpired
module.exports.encryptInformation = encryptInformation