const nodemailer=require('nodemailer')
const { unAuthorizedError } = require('../routes/model/error/error')
require('dotenv').config().parsed

let signup_email=(email="", pattern="")=>{
//  if(service.length==0,subj.length==0||problem.length==0){
//     throw 'cannot make template for e-mail !!'
//  }
//  console.log(status)

return `
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
<div class="container-fluid text-center p-0 m-0 border-0">
    <h1 class="p-5">Verify email ${
        pattern=="signup"?"for sign up": 
        pattern=="resetpwd"?"for reset password": ""
    }</h1>
    <hr>
    <div class="pt-2 pb-5">
        <p>In order we are getting verified account ${
            pattern=="signup"?"for new account": 
            pattern=="resetpwd"?"for reset account password": ""
        }
        with <b>${email}</b> before expired in 30 minutes by click the button below </p>
    </div>
    <div class="mx-auto">
        <a href="${process.env.BACKEND_HOST}/api/authentication/verify?email=${email}" class="btn btn-success text-center">Verify my email</a>
    </div>
</div>
`
}

const sendMail=async (html=undefined,sub=undefined,to=undefined)=>{
    // let status=undefined

    // if(positionName==undefined||res==undefined||sub==undefined||html==undefined||to==undefined){
    //     throw 'Invalid data cannot send mail'
    // }
    //fortesting account
    // let testAccount =await nodemailer.createTestAccount()

    // let transporter = nodemailer.createTransport({
    //     host:"smtp.ethereal.email",
    //     port:587,
    //     secure:false,
    //     auth:{
    //         user:testAccount.user,
    //         pass:testAccount.pass
    //     }
    // })

    // let content ={
    //     from: '"admin IT" <no-reply@gmail.com>',
    //     to:'pheeraprt0123@gmail.com',
    //     subject:"hello",
    //     text:"hello world?",
    //     html:"<h1>hello WW</h1>"
    // }

    // transporter.sendMail(content)
    // .then(info=>{
    //     status=true
    //     console.log(info.messageId)
    //     console.log(nodemailer.getTestMessageUrl(info))
    // })
    // .catch(err=>{
    //     status=false
    //     console.log(err)
    // })
    // return status

    // for real account
    let config = {
        service:'gmail',
        auth:{
            user:process.env.MAILER_GMAIL,
            pass:process.env.MAILER_PASSWORD
        }
    }

    let transporter = nodemailer.createTransport(config)
    
    let content = {
        from: '"Leafy" <no-reply@gmail.com>',
        to:to,
        subject:sub,
        html: html
    }

    try {
        if(sub==undefined||html==undefined||to==undefined){
            throw new Error('invalid parameter data cannot send email!!!')
        }

        transporter.sendMail(content)
        .then (info=>{
            console.log(`send mail to ${to}`)
            if(info==undefined||info==false){
                unAuthorizedError("Email not found")
               //  return res.status(500).json(errorModel(error,req.originalUrl))
                // return status=false   
            }else{
                console.log(`mail sended to ${to}!! : ${info.messageId} sucessfully`)

               //  return res.status(201).json({msg:'email sended!!'})
                // return status= true
            }    
            console.log(nodemailer.getTestMessageUrl(info))
        })
    } catch (error) {
        console.log(error)
        unAuthorizedError("cannot send email")
    }
}

module.exports.sendMail=sendMail
module.exports.signup_email=signup_email