const jwt = require("jsonwebtoken");
const { errorRes } = require('./../routes/model/error/error')
const { getUser } = require('../routes/model/class/utils/jwtUtils')

const dotenv = require('dotenv');

// get config vars
dotenv.config();

exports.JwtAuth = (req, res, next) => {
  // เอา token จาก headers or cookies
  const jwtToken = "Bearer " + req.cookies.token;
  // const jwtRefreshToken = req.headers.refresh || "Bearer " + req.cookies.refreshToken ;
  // ตรวจสอบถ้าไม่มี token จะเข้าสู่ระบบไม่ได้
  if ([null, undefined].includes(req.cookies.token)) return res.status(401).json(errorRes("need login first", req.originalUrl))
  try {
    // ตรวจสอบ user ใน access token 
    let user = jwt.verify(jwtToken.substring(7), process.env.TOKEN_SECRET);
    console.log(user)
    // ตรวจสอบใน token มีการทำ format ของ user ถูกต้องไหม
    if (user.email === undefined || user.role === undefined) {
      return res.status(401).json(errorRes("invalid token", req.originalUrl))
    }
    // ถ้าเจอจะ request ไปยัง user
    req.user = user;
    next();
  } catch (err) {
    // ถ้า access token ไม่ถูกต้องหรือหมดอายุ
    return res.status(401).json(errorRes("Access token: " + err.message, req.originalUrl))
  }
};

exports.UnstrictJwtAuth = (req, res, next) => {
  // เอา token จาก headers or cookies
  const jwtToken = "Bearer " + req.cookies.token;
  // const jwtRefreshToken = req.headers.refresh || "Bearer " + req.cookies.refreshToken ;
  console.log(req.cookies.token)
  try {
    if (req.cookies.token !== undefined) {
      // ตรวจสอบ user ใน access token 
      let user = jwt.verify(jwtToken.substring(7), process.env.TOKEN_SECRET);
      console.log(user)
      // ตรวจสอบใน token มีการทำ format ของ user ถูกต้องไหม
      if (user.email === undefined || user.role === undefined) {
        return res.status(401).json(errorRes("invalid token", req.originalUrl))
      }
      // ถ้าเจอจะ request ไปยัง user
      req.user = user;
    }
    next();
  } catch (err) {
    // ถ้า access token ไม่ถูกต้องหรือหมดอายุ
    return res.status(401).json(errorRes("Access token: " + err.message, req.originalUrl))
  }
};

exports.verifyRole = (...roles) => {
  return (req, res, next) => {
    // เรียก role จาก header หรือ cookie
    const jwtToken = "Bearer " + req.cookies.token;
    const reqRole = getUser(jwtToken.substring(7)).role;

    // ถ้าไม่มี role จะไม่มีสิทธิ์สำหรับการเข้าระบบ
    if (!reqRole) return res.status(403).json(errorRes("the role is null", req.originalUrl));
    const result = [...roles].includes(reqRole);

    // ถ้า role ไม่ใช่ user, admin_it และ admin_pr จะไม่มีสิทธิ์สำหรับการเข้าระบบในส่วนนั้น
    if (!result) return res.status(403).json(errorRes("the role is not allowed to use", req.originalUrl));
    next();
  }
}

