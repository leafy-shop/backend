const moment =require('moment')
// เอาไว้แสดง log ของ server
const logger =(req,res,next)=>{
    // console.log('hello world!')
    // ให้แสดง link ของ host และวันที่
    console.log(`${req.method} - ${req.protocol}://${req.get('host')}${req.originalUrl} : ${moment().format()}`)
    next()
}

module.exports=logger