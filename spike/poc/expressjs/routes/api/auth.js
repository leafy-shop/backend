const express = require('express')
const router = express.Router()
const { getToken, getUser, refreshToken, isExpired } = require('./../model/class/jwtUtils')
const {errorRes} = require('./../model/error/error')
const argon2 = require('argon2')
// const { v4: uuidv4 } = require('uuid')

// const bcrypt = require('bcrypt')

const dotenv = require('dotenv');
const cookieParser = require('cookie-parser')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// get config vars
dotenv.config();

router.post('/', async (req, res) => {
    // เก็บ email และ password ของผู้ใช้
    const { email, password } = req.body;

    // เรียกข้อมูล user โดยใช้ email
    let user = await prisma.users.findFirst({
        where: {
            email: email
        }
    })

    // ถ้า email หาไม่เจอก็จะส่งกลับไปเพื่อใช้ในการทำ reset password
    if (user == null) {
        return res.status(404).json(errorRes(`user email ${email} does not exist`, req.originalUrl))
    }

    const hashingConfig = { // based on OWASP cheat sheet recommendations (as of March, 2022)
        parallelism: 1,
        memoryCost: 64000, // 64 mb
        timeCost: 3 // number of itetations
    }
    
    // ตรวจสอบ password ที่ได้จาก mysql2 ว่าเป็น hash match กับ password ที่กรอกมาหรือป่าว
    if (!(await argon2.verify(user.password,password,hashingConfig))) {
        return res.status(401).json(errorRes("user email or password is invalid please login again", req.originalUrl))
    }

    // // ตรวจสอบสถานะของ user
    // else if (user.user_status !== 'active') {
    //     return res.status(403).json(errorRes("this user is inactive!", req.originalUrl))
    // }

    // ลบ password ของ user ก่อน response กลับไป
    delete user.password;

    console.log(user)

    // สร้าง access token ภายใต้ method ที่กำหนด
    const token = getToken({
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }, "1h");

    // และ refresh token แต่เวลาต่างกัน
    const refreshtoken = getToken({
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }, "24h");

    // console.log(token)
    console.log(getUser(token).user_role)

    // เก็บเป็น cookie ให้ผู้พัฒนา backend สามารถใช้งานได้
    const cookieConfig = {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'Strict'
        // secure: true
    }
    res.cookie("token", token, cookieConfig);
    res.cookie("refreshToken", refreshtoken, cookieConfig);
    // res.cookie("user_email", getUser(token).user_email);
    // res.cookie("user_role", getUser(token).user_role);
    // res.cookie("user_first_name", getUser(token).user_first_name)
    // res.cookie("user_last_name", getUser(token).user_last_name)
    res.status(200).json({
        "name": getUser(token).name,
        "email": getUser(token).email,
        "role": getUser(token).role,
        "token": token,
        "refreshToken": refreshtoken
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

    let token = refreshToken(jwttoken.substring(7), jwttoken.substring(7), userInfo, "30m")
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
    // res.cookie("user_emp_code", getUser(token).user_emp_code)
    // res.cookie("user_email", getUser(token).user_email);
    // res.cookie("user_role", getUser(token).user_role);
    // res.cookie("user_first_name", getUser(token).user_first_name)
    // res.cookie("user_last_name", getUser(token).user_last_name)
    res.status(200).json({
        "name": getUser(token).name,
        "email": getUser(token).email,
        "role": getUser(token).role,
        "token": getUser(token).token,
        "refreshToken": getUser(token).refreshToken
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

module.exports = router