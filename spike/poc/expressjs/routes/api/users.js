const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateBoolean, validateEmail, validatePassword, validateRole, validateDatetimeFuture, validatePhone } = require('../validation/body')
let { notFoundError, validatError, forbiddenError } = require('./../model/error/error')
let { sendMail } = require('./../../config/email_config')

const { JwtAuth, verifyRole } = require('./../../middleware/jwtAuth')
const { ROLE } = require('./../model/enum/role')
const { userView, userDetailView } = require('./../model/class/model')
const { PrismaClient, Prisma } = require('@prisma/client');
const { timeConverter, userConverter } = require('../model/class/utils/converterUtils');
const prisma = new PrismaClient()

// Exclude keys from user
// const user = {
//     userId: true,
//     name: true,
//     email: true,
//     role: true,
//     createdAt: true,
//     updatedAt: true
// }

// user demo
const user_db = [
    {
        "name": "admin",
        "email": "sahatat44@gmail.com",
        "password": "abcd1234",
        "role": "admin",
        "userinfo": {
            "firstname": "sahathat",
            "lastname": "yingsakulkiet",
            "dob": "2000-01-01",
            "phone": "090-000-0000",
            "address": "Asia Bangkok"
        }
    },
    {
        "name": "aaeed",
        "email": "piraphat123@gmail.com",
        "password": "abcd1234",
        "role": "user",
        "userinfo": {}
    },
    {
        "name": "zee",
        "email": "piraphat1234@gmail.com",
        "password": "abcd1234",
        "role": "admin",
        "userinfo": {
            "firstname": "piraphat",
            "lastname": "kakerd",
            "dob": "2000-01-01",
            "phone": "090-100-0000",
            "address": "Asia Bangkok"
        }
    },
    {
        "name": "fern",
        "email": "panalee.fern@mail.kmutt.ac.th",
        "password": "abcd1234",
        "role": "user",
        "userinfo": {
            "firstname": "panalee",
            "lastname": "palasri",
            "dob": "2000-01-01",
            "phone": "090-200-0000",
            "address": "Asia Bangkok"
        }
    }
]

router.get('/', JwtAuth, verifyRole(ROLE.Admin), async (req, res) => {
    // let sorting = req.query.sort == 'desc' ? 'desc' : 'asc'
    // console.log(req.query.name)
    let page = Number(req.query.page)
    let limit = Number(req.query.limit)
    let count_user = await prisma.accounts.count()
    let filter_u = await prisma.accounts.findMany({
        skip: page > 0 ? (page - 1) * limit : 0,
        take: limit > 1 ? limit : count_user,
        where: {
            AND: [{
                name: {
                    contains: req.query.name
                }
            },
            {
                email: {
                    contains: req.query.email
                }
            },
            {
                role: req.query.role
            }]
        },
        select: userView,
        orderBy: { updatedAt: "desc" }
    })
    return res.json(timeConverter(filter_u))
})

router.get('/:id', JwtAuth, async (req, res, next) => {
    try {
        // sendMail("test massage","test",req.user.email)
        let user = await verifyId(req.params.id)
        // user role checking and profile
        if (req.user.role !== ROLE.Admin) {
            if (req.user.email !== user.email) {
                forbiddenError("you can view yourself only")
            }
        }
        return res.json(user)
    } catch (err) {
        next(err)
    }
})

router.post('/', JwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    let { name, email, role, password, userinfo } = req.body
    try {
        let input = await prisma.accounts.create({
            data: {
                name: validateStr("account name", name, 100),
                email: validateEmail("account email", email, 100),
                role: validateRole("account role", role, ROLE),
                password: await validatePassword("account password", password, 8, 20)
            },
            select: userView
        })
        if (userinfo !== undefined) {
            await prisma.userinfo.create({
                data: {
                    accounts_userId: input.userId,
                    firstname: validateStr("user information firstname", userinfo.firstname, 50),
                    lastname: validateStr("user information lastname", userinfo.lastname, 50),
                    dob: validateDatetimeFuture("user information date of birth", userinfo.dob),
                    phone: validatePhone("user information phone", userinfo.phone),
                    address: validateStr("user information address", userinfo.address, 500, true)
                }
            })
        }
        return res.json(timeConverter(input))
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            console.log(err.meta)
            if (err.meta.target === 'Users_email_key') {
                err.message = "user email is duplicated"
            } else if (err.meta.target == 'phone_UNIQUE') {
                err.message = "user phone is duplicated"
            }
        }
        next(err)
    }
})

router.patch('/:id', JwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    try {
        // convert string to int
        let id = Number(req.params.id)

        // check user exist
        await verifyId(id)

        // user accounts
        let mapUser = {}

        // user account
        // name: validateStr("name", name, 100),
        // email: validateEmail("email", email, 100),
        // role: validateRole("role", role, ROLE),
        // password: await validatePassword("password", password, 8, 20)
        for (let i in req.body) {
            if (req.body[i] != undefined) {
                mapUser[i] =
                    i == "name" ? validateStr("user name", req.body[i], 100) :
                        // i == "email" ? validateEmail("user email", req.body[i], 100) : cannot edit email
                        i == "role" ? validateRole("user role", req.body[i], ROLE) :
                            i == "password" ? await validatePassword("user password", req.body[i], 8, 20) :
                                i == "status" ? validateBoolean("user status", req.body[i]) : undefined
            }
        }

        // user info
        let mapUserInfo = {}

        // user info
        // firstname: validateStr("user information firstname", userinfo.firstname, 50),
        // lastname: validateStr("user information lastname", userinfo.lastname, 50),
        // dob: validateDatetimeFuture("user information date of birth", userinfo.dob),
        // phone: validatePhone("user information phone", userinfo.phone),
        // address: validateStr("user information address", userinfo.address, 500, true)
        if (req.body.userinfo !== undefined) {
            for (let i in req.body.userinfo) {
                if (req.body.userinfo[i] != undefined) {
                    mapUserInfo[i] =
                        i == "firstname" ? validateStr("user information firstname", req.body.userinfo[i], 50) :
                            i == "lastname" ? validateStr("user information lastname", req.body.userinfo[i], 50) :
                                i == "dob" ? validateDatetimeFuture("user information date of birth", req.body.userinfo[i]) :
                                    i == "phone" ? validatePhone("user information phone", req.body.userinfo[i]) :
                                        i = "address" ? validateStr("user information address", req.body.userinfo[i], 500, true) : undefined
                }
            }
        }

        // console.log(mapUser)
        // console.log(mapUserInfo)

        // update data in user account table
        let input = await prisma.accounts.update({
            where: {
                userId: id
            },
            data: mapUser,
            select: userView
        })

        // find user info when create or not
        let userInfo = await prisma.userinfo.findFirst({
            where: {
                accounts_userId: id
            }
        })

        // update user info table
        if (userInfo == null) {
            // if user info cannot found when create user account that create user info
            mapUserInfo.accounts_userId = id
            input.userinfo = await prisma.userinfo.create({
                data: mapUserInfo
            })
        } else {
            // else user info found when create user account that update user info
            input.userinfo[0] = await prisma.userinfo.update({
                where: {
                    accounts_userId: id
                },
                data: mapUserInfo
            })
        }
        return res.json(userConverter(input))
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2002') {
                err.message = "email is duplicated"
            }
        }
        next(err)
    }
})

router.delete('/:id', JwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    try {
        let user = await verifyId(req.params.id)
        if (user.email === req.user.email) {
            forbiddenError("you cannot delete myself")
        }

        if(user.userinfo.length !== 0){
            await prisma.userinfo.delete({
                where: {
                    accounts_userId: validateInt("userId", Number(req.params.id))
                }
            })
        }
        await prisma.accounts.delete({
            where: {
                userId: Number(req.params.id)
            }
        })
        return res.json({ message: "user id " + req.params.id + " has been deleted" })
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2003') {
                err.message = "cannot delete user when they have own product or order"
            }
        }
        next(err)
    }
})

const verifyId = async (id) => {
    let filter_u = await prisma.accounts.findFirst({
        // include: {
        //     userinfo: true
        // },
        where: {
            userId: validateInt("userId", Number(id))
        },
        select: userDetailView()
    })
    // not found checking
    if (filter_u == null) notFoundError("user id " + id + " does not exist")
    return userConverter(filter_u)
}

module.exports = router