// เหมือนกับ import 
const express =require("express")
const logger =require('./middleware/logger')
const cors =require('cors')
const cookieParser = require('cookie-parser')
const compression = require("compression"); // reduce loading of all site
const {errorRes} = require("./routes/model/error/error")
require('dotenv').config().parsed
let corsOptions = {
    origin: process.env.CLIENT_HOST||'http://localhost:5173',
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
    credentials:true
}

const app = express()

// Set up rate limiter: maximum of twenty requests per minute
const RateLimit = require("express-rate-limit");
const limiter = RateLimit({
  windowMs: 1 * 30 * 1000, // 30 second
  max: 20000,
});

// Apply rate limiter to all requests
app.use(limiter);

// Init Middleware
app.use(logger)
app.use(cors(corsOptions))
app.use(compression())

app.use(cookieParser())

// Body parse middleware สำหรับแปลงค่าเพื่อสำหรับแสดงผล request ที่ส่งเข้ามา
app.use(express.json())
app.use(express.urlencoded({ extended: false}))

// route ไปยังไฟล์ที่สามารถ req,res ได้
app.use('/api/authentication',require('./routes/api/auth.js'))
app.use('/api/products',require('./routes/api/products.js'))
app.use('/api/users',require('./routes/api/users.js'))
app.use('/api/carts',require('./routes/api/carts.js'))
// app.use('/api/problems',require('./routes/api/problem.js'))
// app.use('/api/solutions',require('./routes/api/solution.js'))
// app.use('/api/authentication',require('./routes/api/authen.js'))
app.use('/api/image',require('./routes/api/image.js'))
app.use('/api/images',require('./routes/api/productImages.js'))
// app.use('/api/send-mail',require('./routes/api/mailer.js'))

const errorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error)
      }
    // Error handling middleware functionality
    console.log("")
    console.log(error.stack) // log the error
    console.log("")
    const status = error.status || 400
    // send back an easily understandable error message to the caller
    res.status(status).send(errorRes(error.message,req.originalUrl))
}

app.use(errorHandler)

const PORT =process.env.PORT || 5000

// Error object used in error handling middleware function
// class AppError extends Error{
//     statusCode: number;

//     constructor(statusCode: number, message: string) {
//       super(message);
  
//       Object.setPrototypeOf(this, new.target.prototype);
//       this.name = Error.name;
//       this.statusCode = statusCode;
//       Error.captureStackTrace(this);
//     }
// }

// Fallback Middleware function for returning 
// 404 error for undefined paths
const invalidPathHandler = (request, response, next) => {
    response.status(404)
    response.send('invalid path')
}

// Attach the fallback Middleware
// function which sends back the response for invalid paths)
app.use(invalidPathHandler)

app.listen(PORT,()=>console.log(`server is run on port ${PORT}`))