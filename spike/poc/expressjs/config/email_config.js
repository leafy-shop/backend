const nodemailer=require('nodemailer')
require('dotenv').config().parsed

// let report_html=(service='',subj='',tOfUse='',tOfMachine='',brand='',problem='',other='',msg='',status='')=>{
//  if(service.length==0,subj.length==0||problem.length==0){
//     throw 'cannot make template for e-mail !!'
//  }
//  console.log(status)

//  let info_service=`
//  <tr>
//  <th style="width:50%;text-align: right;">
//     Subject :
//  </th>
//  <td style="width:50%;text-align: left;">
//     ${service.length==0?'-':service}
//  </td>
// </tr>
//  `

//  let info_subj=`
//  <tr>
//  <th style="width:50%;text-align: right;">
//     Subject :
//  </th>
//  <td style="width:50%;text-align: left;">
//     ${subj.length==0?'-':subj}
//  </td>
// </tr>
//  `

//  let info_machine=tOfMachine.length==0?'':`
//  <tr>
//    <th style="width:50%;text-align: right;">
//       Type of machine :
//    </th>
//    <td style="width:50%;text-align: left;">
//       ${tOfMachine}
//    </td>
// </tr>
//  `

//  let info_use=tOfUse.length==0?'':`
//  <tr >
//    <th style="width:50%;text-align: right;">
//       Type of use :
//    </th>
//    <td style="width:50%;text-align: left;">
//       ${tOfUse=='or'?'อุปกรณ์ขององค์กร':'อุปกรณ์ส่วนตัว'}
//    </td>
// </tr>
//  `

// let info_brand=brand.length==0?'':`
// <div style="margin:10px 15px 0px 15px;">
//    <h5 style="display: block;text-align: left;font-weight: bold;">
//       Brand : ${brand}
//    </h5>
// </div>
// `

//  let info_problems=`
//  <div style="margin:10px 15px 0px 15px;">
//    <h5 style="display: block;text-align: left;font-weight: bold;">
//       ปัญหาที่พบ : ${problem.length==0?'-':problem}
//    </h5>
// </div>
//  `

//  let info_other=`
//  <div style="margin:10px 15px 0px 15px;">
//    <h5 style="display: block;text-align: left;font-weight: bold;">
//       ปัญหาอื่นๆ ที่พบเจอ : ${other.length==0?'-':other}
//    </h5>
// </div>
//  `
 
//  let info_message=`
//  <div style="margin:10px 15px 0px 15px;">
//    <h5 style="display: block;text-align: left;font-weight: bold;">
//       เพิ่มเติม : ${msg.length==0?'-':msg}
//    </h5>
// </div>
//  `

//  let info_status=`
//  <div style="margin:10px 15px 0px 15px;">
//    <h5 style="display: block;text-align: left;font-weight: bold;">
//       สถานะของการรับแจ้ง : ${status.length==0?'-':status}
//    </h5>
// </div>
//  `

// return `
// <div style='width:100%;height:fit-content;font-size:15px'>        
//      <div style="=width:90%;margin:auto;">
//      <h5 style='width:fit-content;margin:auto;margin-top:10px;margin-bottom:10px;font-size: 23px;font-weight: bold;'>คำร้องขอรับบริการของคุณ</h5>

//         <hr style="width: 60%;margin:auto;border-top: 2px solid gray;">
//         <table style="width:100%;margin:15px auto 15px auto;">`
//             +info_service
//             +info_subj
//             +info_use
//             +info_machine
//          +`   
//          </table>
//         <hr style="width: 60%;margin:auto;border-top: 2px solid gray">
//         <div style="width:80%;margin-top: 15px;margin:auto;text-align: left;">`
//                +info_brand
//                +info_problems
//                +info_other
//                +info_message
//                +info_status
//         +`</div>
//      </div>
//   </div> 
// `
// }

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
        text:sub,
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
                console.log('cannot send mail !!')
               //  return res.status(500).json(errorModel(error,req.originalUrl))
                // return status=false   
            }else{
                console.log(`mail sended to ${to}!! :`,info.messageId)
               //  return res.status(201).json({msg:'email sended!!'})
                // return status= true
            }    
            // console.log(nodemailer.getTestMessageUrl(info))
        })
    } catch (error) {
        console.log(error)
        throw 'cannot send mail'
    }
}

module.exports.sendMail=sendMail
// module.exports.report_html=report_html