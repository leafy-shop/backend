const express = require('express')
const router = express.Router()
const { getToken, getUser, isExpired, encryptInformation } = require('../../model/class/utils/jwtUtils')
const { errorRes, notFoundError, unAuthorizedError, forbiddenError } = require('../../model/error/error')
const argon2 = require('argon2')
const crypto = require('crypto')
const cryptoJs = require('crypto-js')
// const { v4: uuidv4 } = require('uuid')

// const bcrypt = require('bcrypt')

const dotenv = require('dotenv');
const cookieParser = require('cookie-parser')

const { PrismaClient } = require('@prisma/client')
const { UnstrictJwtAuth } = require('../../../middleware/jwtAuth')
const { ROLE } = require('../../model/enum/role')
const { validatePassword } = require('../../validation/body')
const { sendMail, signup_email } = require('../../../config/email_config')
const prisma = new PrismaClient()

// get config vars
dotenv.config();

router.post('/', async (req, res, next) => {
    try {
        // เก็บ email และ password ของผู้ใช้
        const { email_phone, password } = req.body;

        // เรียกข้อมูล user โดยใช้ email
        let user = await prisma.accounts.findFirst({
            where: {
                OR: [
                    { email: email_phone },
                    { phone: email_phone },
                    { username: email_phone }
                ]
            }
        })

        // ถ้า email หาไม่เจอก็จะส่งกลับไปเพื่อใช้ในการทำ reset password
        if (user == null) {
            return res.status(404).json(errorRes(`user email, username or phone does not exist`, req.originalUrl))
        }

        // ตรวจสอบสถานะของ user
        else if (!user.status) {
            return res.status(403).json(errorRes("this user is inactive!", req.originalUrl))
        }

        // ตรวจสอบการยืนยันผ่าน email ของ user
        // if (!user.verifyAccount) {
        //     // ตรวจสอบว่าถ้า cookie ตรงกันกับ authorization header ที่กำหนดไว้จะทำการปลดล็อค account คนนั้นให้ใช้งานได้ตามปกติ
        //     if (req.cookies !== undefined && req.headers.authorization !== undefined) {
        //         if (req.cookies.vf_em == req.headers.authorization.substring(7)) {
        //             // เปลี่ยนให้ user สามารถ login ได้
        //             await prisma.accounts.update({
        //                 where: {
        //                     email: email
        //                 },
        //                 data: {
        //                     verifyAccount: true
        //                 }
        //             })
        //             return res.json({ "message": "verify user complete please login again" })
        //         } else {
        //             unAuthorizedError("verify token is invalid!!")
        //         }
        //     }
        //     // send to email
        //     await sendMail(signup_email(user.email, "signup", res), "Add new account", user.email)
        //     unAuthorizedError("please activate email for avaliable!")
        // }

        const hashingConfig = { // based on OWASP cheat sheet recommendations (as of March, 2022)
            parallelism: 1,
            memoryCost: 64000, // 64 mb
            timeCost: 3 // number of itetations
        }

        // ตรวจสอบ password ที่ได้จาก mysql2 ว่าเป็น hash match กับ password ที่กรอกมาหรือป่าว
        if (!(await argon2.verify(user.password, password, hashingConfig))) {
            return res.status(401).json(errorRes("user email, username or password is invalid please login again", req.originalUrl))
        }

        // ลบ password ของ user ก่อน response กลับไป
        delete user.password;

        // get user info
        console.log(user)

        // สร้าง access token ภายใต้ method ที่กำหนด
        const token = getToken({
            "id": user.userId,
            "username": user.username,
            "firstname": user.firstname,
            "lastname": user.lastname,
            "email": user.email,
            "role": user.role,
        }, "1h");

        // เก็บเป็น cookie ให้ผู้พัฒนา backend สามารถใช้งานได้
        const cookieConfigToken = {
            maxAge: 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'Strict'
            // secure: true
        }

        // และ refresh token แต่เวลาต่างกัน
        const refreshtoken = getToken({
            "id": user.userId,
            "username": user.username,
            "firstname": user.firstname,
            "lastname": user.lastname,
            "email": user.email,
            "role": user.role,
        }, "24h");

        // เก็บเป็น cookie ให้ผู้พัฒนา frontend สามารถใช้งานได้
        const cookieInfomation = {
            maxAge: 24 * 60 * 60 * 1000,
            // httpOnly: true,
            sameSite: 'Strict'
            // secure: true
        }

        // เก็บเป็น cookie ให้ผู้พัฒนา backend สามารถใช้งานได้
        const cookieConfigRefreshToken = {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'Strict'
            // secure: true
        }
        res.cookie("token", token, cookieConfigToken);
        res.cookie("refreshToken", refreshtoken, cookieConfigRefreshToken);
        res.cookie("information", encryptInformation({
            "id": user.id,
            "username": user.username,
            "firstname": user.firstname,
            "lastname": user.lastname,
            "email": user.email,
            "role": user.role,
        }), cookieInfomation)

        res.status(200).json({
            "id": getUser(token).id,
            "username": getUser(token).username,
            "firstname": getUser(token).firstname,
            "lastname": getUser(token).lastname,
            "email": getUser(token).email,
            "role": getUser(token).role,
        })
    } catch (err) {
        next(err)
    }
})

router.post('/refresh', async (req, res, next) => {
    try {
        // เรียก refresh token เพื่อใช้ในการ refresh ถ้าหากเป็น access token จะทำการลบข้อมูลของ user ทำให้ส่ง token ผิด
        const jwtRefreshToken = "Bearer " + req.cookies.refreshToken;
        const userInfo = JSON.parse(cryptoJs.AES.decrypt(req.cookies.information, process.env.TOKEN_INFO_SECRET).toString(cryptoJs.enc.Utf8))
        // console.log(userInfo)
        // const jwttoken = "Bearer " + req.cookies.token
        // let userInfo = cryptoreq.cookies.infomation;

        // if refresh token expired that removed cookie and response
        if (isExpired(jwtRefreshToken.substring(7)) || jwtRefreshToken.substring(7).length === 0) {
            // clear session cookie
            // const cookieConfig = {
            //     httpOnly: true,
            //     sameSite: 'Strict'
            //     // secure: true
            // }
            unAuthorizedError("token is expired, need login again")
        }

        // เรียกข้อมูล user โดยใช้ email
        let user = await prisma.accounts.findFirst({
            where: { email: userInfo.email }
        })

        // สร้าง refresh token ใหม่ทั้ง token และ refreshToken
        let userToken = {
            "id": user.userId,
            "username": user.username,
            "firstname": user.firstname,
            "lastname": user.lastname,
            "email": user.email,
            "role": user.role,
        }

        let token = getToken(userToken, "1h")
        let refreshtoken = getToken(userToken, "24h")

        // ตรวจดูว่า token ถูกต้องไหมก่อนส่ง
        if (user === undefined) {
            unAuthorizedError("please input valid refresh token")
        }

        // เก็บเป็น cookie ให้ผู้พัฒนา backend สามารถใช้งานได้
        const cookieConfigToken = {
            maxAge: 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'Strict'
            // secure: true
        }

        // เก็บเป็น cookie ให้ผู้พัฒนา backend สามารถใช้งานได้
        const cookieConfigRefreshToken = {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'Strict'
            // secure: true
        }

        // เก็บเป็น cookie ให้ผู้พัฒนา frontend สามารถใช้งานได้
        const cookieInfomation = {
            maxAge: 24 * 60 * 60 * 1000,
            // httpOnly: true,
            sameSite: 'Strict'
            // secure: true
        }

        res.cookie("token", token, cookieConfigToken);
        res.cookie("refreshToken", refreshtoken, cookieConfigRefreshToken);
        res.cookie("information", encryptInformation({
            "id": getUser(token).id,
            "username": getUser(token).username,
            "firstname": getUser(token).firstname,
            "lastname": getUser(token).lastname,
            "email": getUser(token).email,
            "role": getUser(token).role,
        }), cookieInfomation)

        res.status(200).json({
            "id": getUser(token).id,
            "username": getUser(token).username,
            "firstname": getUser(token).firstname,
            "lastname": getUser(token).lastname,
            "email": getUser(token).email,
            "role": getUser(token).role,
        })
    } catch (err) {
        res.clearCookie("infomation")
        res.clearCookie("token")
        res.clearCookie("refreshToken")
        next(err)
    }
})

router.get("/signout", (req, res) => {
    // verify token
    // const jwtRefreshToken = req.cookies.refreshToken;
    // const jwttoken = req.cookies.token
    // if (jwttoken == undefined || jwtRefreshToken == undefined) {
    //     return res.status(404).json(errorRes("this account not found", req.originalUrl))
    // }

    // clear session cookie
    res.clearCookie("information")
    res.clearCookie("token")
    res.clearCookie("refreshToken")
    return res.status(200).json({ message: "this user is sign out !!" })
})

router.get('/verify', async (req, res, next) => {
    // let { verify } = req.cookies
    let { path, email_phone, vf_token } = req.query

    try {
        // เรียกข้อมูล user โดยใช้ email
        let user = await prisma.accounts.findFirst({
            where: {
                OR: [
                    { email: email_phone },
                    { phone: email_phone }
                ]
            }
        })

        // ถ้า email หาไม่เจอก็จะส่งกลับไปเพื่อใช้ในการทำ reset password
        if (user == null) {
            return res.status(404).json(errorRes(`user email or phone does not exist`, req.originalUrl))
        }

        // ตรวจสอบว่า path ไหนไปได้บ้าง
        if (!["login", "resetpwd"].includes(path)) {
            forbiddenError("url path is invalid or not found")
        }

        if (vf_token === undefined || vf_token !== req.cookies.vf_em) {
            unAuthorizedError("verify token is invalid")
        }

        // เปลี่ยนให้ user สามารถ login ได้
        await prisma.accounts.update({
            where: {
                email: user.email
            },
            data: {
                verifyAccount: true
            }
        })

        // กำจัด cookie ของ verify token
        res.clearCookie("vf_token")

        return res.redirect(301, `${process.env.CLIENT_HOST}/pl4/${path}`)
    } catch (err) {
        // The .code property can be accessed in a type-safe manner
        if (err.code === 'P2025') {
            err.message = "accounts email " + req.query.email + " does not exist"
        }
        next(err)
    }
})

router.put('/resetpwd', UnstrictJwtAuth, async (req, res, next) => {
    let { authorization } = req.headers
    let { email, password } = req.body
    let { vf_em } = req.cookies

    try {
        // เรียกข้อมูลที่จะยืนยัน โดยใช้ token
        if (vf_em !== undefined && vf_em == authorization.substring(7)) {
            res.clearCookie("vf_em")
        } else {
            unAuthorizedError("verify token is invalid or expired, please resign token")
        }

        // user and supplier condition
        if (req.user !== undefined && [ROLE.User, ROLE.Supplier].includes(req.user.role) && req.user.email !== email) {
            forbiddenError("your cannot reset password of other user")
        }

        // เปลี่ยนให้ user สามารถ login ได้
        await prisma.accounts.update({
            where: {
                email: email
            },
            data: {
                password: await validatePassword("account password", password, 8, 20)
            }
        })
        // console.log(vf_pwd_arr[vf_pwd_arr.length - 1])

        return res.json({ message: "user email " + email + " already change password!!" })
    } catch (err) {
        // The .code property can be accessed in a type-safe manner
        if (err.code === 'P2025') {
            err.message = "accounts email " + req.query.email + " does not exist"
        }
        next(err)
    }
})

module.exports = router