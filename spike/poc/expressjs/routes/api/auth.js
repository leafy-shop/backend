const express = require('express')
const router = express.Router()
const { getToken, getUser, refreshToken, isExpired } = require('./../model/class/utils/jwtUtils')
const { errorRes, notFoundError, unAuthorizedError, forbiddenError } = require('./../model/error/error')
const argon2 = require('argon2')
const crypto = require('crypto')
// const { v4: uuidv4 } = require('uuid')

// const bcrypt = require('bcrypt')

const dotenv = require('dotenv');
const cookieParser = require('cookie-parser')

const { PrismaClient } = require('@prisma/client')
const { UnstrictJwtAuth } = require('../../middleware/jwtAuth')
const { ROLE } = require('../model/enum/role')
const { validatePassword } = require('../validation/body')
const prisma = new PrismaClient()

// get config vars
dotenv.config();

router.post('/', async (req, res) => {
    // เก็บ email และ password ของผู้ใช้
    const { email_phone, password } = req.body;

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
        return res.status(404).json(errorRes(`user email or phone ${email_phone} does not exist`, req.originalUrl))
    }

    // ตรวจสอบสถานะของ user
    else if (!user.status) {
        return res.status(403).json(errorRes("this user is inactive!", req.originalUrl))
    }

    // ตรวจสอบการยืนยันผ่าน email ของ user
    else if (!user.verifyAccount) {
        return res.status(401).json(errorRes("please activate email for avaliable!", req.originalUrl))
    }

    const hashingConfig = { // based on OWASP cheat sheet recommendations (as of March, 2022)
        parallelism: 1,
        memoryCost: 64000, // 64 mb
        timeCost: 3 // number of itetations
    }

    // ตรวจสอบ password ที่ได้จาก mysql2 ว่าเป็น hash match กับ password ที่กรอกมาหรือป่าว
    if (!(await argon2.verify(user.password, password, hashingConfig))) {
        return res.status(401).json(errorRes("user email or password is invalid please login again", req.originalUrl))
    }

    // ลบ password ของ user ก่อน response กลับไป
    delete user.password;

    // get user info
    console.log(user)

    // สร้าง access token ภายใต้ method ที่กำหนด
    const token = getToken({
        "id": user.userId,
        "firstname": user.firstname,
        "email": user.email,
        "role": user.role,
    }, "1h");

    // และ refresh token แต่เวลาต่างกัน
    const refreshtoken = getToken({
        "id": user.userId,
        "firstname": user.firstname,
        "email": user.email,
        "role": user.role,
    }, "24h");

    // เก็บเป็น cookie ให้ผู้พัฒนา backend สามารถใช้งานได้
    const cookieConfig = {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'Strict'
        // secure: true
    }
    res.cookie("token", token, cookieConfig);
    res.cookie("refreshToken", refreshtoken, cookieConfig);

    res.status(200).json({
        "id": getUser(token).id,
        "firstname": getUser(token).firstname,
        "email": getUser(token).email,
        "role": getUser(token).role,
    })
})

router.post('/refresh', async (req, res) => {
    // เรียก refresh token เพื่อใช้ในการ refresh ถ้าหากเป็น access token จะทำการลบข้อมูลของ user ทำให้ส่ง token ผิด
    const jwtRefreshToken = "Bearer " + req.cookies.refreshToken;
    const jwttoken = "Bearer " + req.cookies.token
    let userInfo = {
        "name": req.body.name,
        "email": req.body.email
    }

    // if refresh token expired that removed cookie and response
    if (isExpired(jwtRefreshToken.substring(7))) {
        // clear session cookie
        const cookieConfig = {
            httpOnly: true,
            sameSite: 'Strict'
            // secure: true
        }
        res.clearCookie("token", cookieConfig)
        res.clearCookie("refreshToken", cookieConfig)
        return res.status(401).json(errorRes("token is expired, need login again", req.originalUrl))
    }

    // สร้าง refresh token ใหม่ทั้ง token และ refreshToken
    let token = refreshToken(jwttoken.substring(7), jwttoken.substring(7), userInfo, "1h")
    let refreshtoken = refreshToken(jwttoken.substring(7), jwtRefreshToken.substring(7), userInfo, "24h")

    // ตรวจดูว่า token ถูกต้องไหมก่อนส่ง
    if ([getUser(token).email, getUser(token).role].includes(undefined)) {
        return res.status(401).json(errorRes("please input valid refresh token", req.originalUrl))
    }
    // เก็บเป็น cookie ให้ผู้พัฒนา backend สามารถใช้งานได้
    const cookieConfig = {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'Strict'
        // secure: true
    }

    res.cookie("token", token, cookieConfig);
    res.cookie("refreshToken", refreshtoken, cookieConfig);

    res.status(200).json({
        "id": getUser(token).id,
        "firstname": getUser(token).firstname,
        "email": getUser(token).email,
        "role": getUser(token).role,
        "token": token,
        "refreshToken": refreshtoken
    })
})

router.get("/signout", (req, res) => {
    // verify token
    const jwtRefreshToken = req.cookies.refreshToken;
    const jwttoken = req.cookies.token
    if (jwttoken == undefined || jwtRefreshToken == undefined) {
        return res.status(404).json(errorRes("this account not found", req.originalUrl))
    }

    // clear session cookie
    res.clearCookie("token")
    res.clearCookie("refreshToken")
    return res.status(200).json({ message: "this user is sign out !!" })
})

router.get('/verify', async (req, res, next) => {
    // let { verify } = req.cookies
    let { email } = req.query

    try {
        // // เรียกข้อมูลที่จะยืนยัน โดยใช้ email
        // if (verify.split(",")[-1] == token) {
        //     unAuthorizedError("verify token is invalid")
        // }

        // generate id
        const verifyToken = crypto.randomBytes(8).toString("hex");
        // config cookies
        const cookieConfig = {
            maxAge: 30 * 60 * 1000, // 30 minutes
            httpOnly: true,
            sameSite: 'Strict'
            // secure: true
        }

        // store in http only cookies
        res.cookie("vf_em", verifyToken, cookieConfig)

        // เปลี่ยนให้ user สามารถ login ได้
        await prisma.accounts.update({
            where: {
                email: email
            },
            data: {
                verifyAccount: true
            }
        })

        return res.json({ token: verifyToken })
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

        return res.json({ message: "user email " + email + " already change password!!"})
    } catch (err) {
        // The .code property can be accessed in a type-safe manner
        if (err.code === 'P2025') {
            err.message = "accounts email " + req.query.email + " does not exist"
        }
        next(err)
    }
})

module.exports = router