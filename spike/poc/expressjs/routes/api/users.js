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
const { firestore } = require('firebase-admin');
const { deleteNullValue } = require('../model/class/utils/modelMapping');
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
        "firstname": "sahathat",
        "lastname": "yingsakulkiet",
        "dob": "2000-01-01",
        "phone": "090-000-0000",
        "address": "Asia Bangkok"
    },
    {
        "name": "aaeed",
        "email": "piraphat123@gmail.com",
        "password": "abcd1234",
        "role": "user",
    },
    {
        "name": "zee",
        "email": "piraphat1234@gmail.com",
        "password": "abcd1234",
        "role": "admin",
        "firstname": "piraphat",
        "lastname": "kakerd",
        "dob": "2000-01-01",
        "phone": "090-100-0000",
        "address": "Asia Bangkok"
    },
    {
        "name": "fern",
        "email": "panalee.fern@mail.kmutt.ac.th",
        "password": "abcd1234",
        "role": "user",
        "firstname": "panalee",
        "lastname": "palasri",
        "dob": "2000-01-01",
        "phone": "090-200-0000",
        "address": "Asia Bangkok"
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
    let { name, email, role, password, firstname, lastname, dob, phone, address } = req.body

    try {
        let input = await prisma.accounts.create({
            data: {
                name: validateStr("account name", name, 100),
                email: validateEmail("account email", email, 100),
                role: validateRole("account role", role, ROLE),
                password: await validatePassword("account password", password, 8, 20),
                firstname: validateStr("user information firstname", firstname, 50, true),
                lastname: validateStr("user information lastname", lastname, 50, true),
                dob: validateDatetimeFuture("user information date of birth", dob, true),
                phone: validatePhone("user information phone", phone),
                address: validateStr("user information address", address, 500, true)
            },
            select: userView
        })
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

        // user info
        // firstname: validateStr("user information firstname", userinfo.firstname, 50),
        // lastname: validateStr("user information lastname", userinfo.lastname, 50),
        // dob: validateDatetimeFuture("user information date of birth", userinfo.dob),
        // phone: validatePhone("user information phone", userinfo.phone),
        // address: validateStr("user information address", userinfo.address, 500, true)
        for (let i in req.body) {
            if (req.body[i] != undefined) {
                mapUser[i] =
                    i == "name" ? validateStr("user name", req.body[i], 100) :
                        // i == "email" ? validateEmail("user email", req.body[i], 100) : cannot edit email
                        i == "role" ? validateRole("user role", req.body[i], ROLE) :
                            i == "password" ? await validatePassword("user password", req.body[i], 8, 20) :
                                i == "status" ? validateBoolean("user status", req.body[i]) :
                                    i == "firstname" ? validateStr("user information firstname", req.body[i], 50, true) :
                                        i == "lastname" ? validateStr("user information lastname", req.body[i], 50, true) :
                                            i == "dob" ? validateDatetimeFuture("user information date of birth", req.body[i], true) :
                                                i == "phone" ? validatePhone("user information phone", req.body[i]) :
                                                    i = "address" ? validateStr("user information address", req.body[i], 500, true) : undefined
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
            select: userDetailView
        })

        return res.json(userConverter(input))
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

router.delete('/:id', JwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    try {
        let user = await verifyId(req.params.id)
        if (user.email === req.user.email) {
            forbiddenError("you cannot delete myself")
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
        select: userDetailView
    })
    // not found checking
    if (filter_u == null) notFoundError("user id " + id + " does not exist")

    // delete null value object
    filter_u = deleteNullValue(filter_u)

    return userConverter(filter_u)
}

module.exports = router