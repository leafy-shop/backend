const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateBoolean, validateEmail, validatePassword, validateRole, validateDatetimeFuture, validatePhone } = require('../validation/body')
let { notFoundError, validatError, forbiddenError } = require('./../model/error/error')
let { sendMail } = require('./../../config/email_config')

const { JwtAuth, verifyRole, UnstrictJwtAuth } = require('./../../middleware/jwtAuth')
const { ROLE } = require('./../model/enum/role')
const { userView, userDetailView } = require('./../model/class/model')
const { PrismaClient, Prisma } = require('@prisma/client');
const { timeConverter, userConverter, paginationList } = require('../model/class/utils/converterUtils');
// const { firestore } = require('firebase-admin');
const { deleteNullValue } = require('../model/class/utils/modelMapping');
const { listFirstImage, findImagePath } = require('../model/class/utils/imageList');
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
        "firstname": "sahathat",
        "lastname": "yingsakulkiet",
        "email": "sahatat44@gmail.com",
        "password": "abcd1234",
        "role": "admin",
        "phone": "090-000-0000",
    },
    {
        "email": "piraphat123@gmail.com",
        "password": "abcd1234",
        "role": "user",
    },
    {
        "firstname": "piraphat",
        "lastname": "kakerd",
        "email": "piraphat1234@gmail.com",
        "password": "abcd1234",
        "role": "admin",
        "phone": "090-100-0000",
    },
    {
        "firstname": "panalee",
        "lastname": "palasri",
        "email": "panalee.fern@mail.kmutt.ac.th",
        "password": "abcd1234",
        "role": "user",
        "phone": "090-200-0000"
    }
]

router.get('/', JwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    // let sorting = req.query.sort == 'desc' ? 'desc' : 'asc'
    // console.log(req.query.name)
    let page = Number(req.query.page)
    let limit = Number(req.query.limit)
    // let varPage = page > 0 ? (page - 1) * limit : 0
    // let varLimit = (limit <= 0 || isNaN(limit)) ? 0 : limit >= 10 ? 10 : limit
    // let count_user = await prisma.accounts.count()
    let filter_u = await prisma.accounts.findMany({
        where: {
            AND: [{
                firstname: {
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

    // make to page
    let page_u = paginationList(filter_u, page, limit, 10)

    // array converter and image mapping
    Promise.all(
        // list user with image
        page_u.data.map(user => timeConverter(user))
        // filter_pd.map(user => userConverter(user, userList))
    ).then(userList => {
        page_u.data = userList
        return res.json(page_u)
    }).catch(err => {
        next(err)
    })

    // return res.json({ "page": page, "pageSize": varLimit, "AllPage": Math.ceil(filter_u.length / varLimit), "users": page_u.map(user => timeConverter(user)) })
})

// const getUserIcon = async (res, user) => {
//     user.image = await listFirstImage(res, findImagePath("users", user.itemId))
//     return user
// }

router.get('/:id', JwtAuth, async (req, res, next) => {
    try {
        // sendMail("test massage","test",req.user.email)
        let user = await verifyId(req.params.id)

        console.log(user)

        // user role checking and profile
        if (req.user.role !== ROLE.Admin) {
            if (req.user.email !== user.email) {
                forbiddenError("you can view yourself only")
            }
        }

        // image for product
        let path = findImagePath("users", user.userId)
        user.image = await listFirstImage(res, path)


        return res.json(user)
    } catch (err) {
        next(err)
    }
})

router.post('/', UnstrictJwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    let { userId, email, role, password, firstname, lastname, phone } = req.body

    try {
        let input
        if (req.user.role === ROLE.Admin) {
            // admin user
            input = await prisma.accounts.create({
                data: {
                    userId: isNaN(userId) ? undefined : validateInt("item id", userId, true),
                    firstname: validateStr("user information firstname", firstname, 50),
                    lastname: validateStr("user information lastname", lastname, 50),
                    email: validateEmail("account email", email, 100),
                    role: validateRole("account role", role, ROLE),
                    password: await validatePassword("account password", password, 8, 20),
                    phone: validatePhone("user information phone", phone),
                },
                select: userView
            })
        } else {
            // sign up case
            input = await prisma.accounts.create({
                data: {
                    userId: isNaN(userId) ? undefined : validateInt("item id", userId, true),
                    firstname: validateStr("user information firstname", firstname, 50),
                    lastname: validateStr("user information lastname", lastname, 50),
                    email: validateEmail("account email", email, 100),
                    password: await validatePassword("account password", password, 8, 20),
                    phone: validatePhone("user information phone", phone)
                },
                select: userView
            })
        }

        return res.status(201).json(timeConverter(input))
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            // console.log(err.meta)
            if (err.meta.target === 'PRIMARY') {
                err.message = "this user is duplicated"
            } else if (err.meta.target === 'Users_email_key') {
                err.message = "user email is duplicated"
            } else if (err.meta.target == 'phone_UNIQUE') {
                err.message = "user phone is duplicated"
            } else if (err.meta.target == 'Fullname_UNIQUE') [
                err.message = "full name is duplicated"
            ]
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
                    // i == "email" ? validateEmail("user email", req.body[i], 100) : cannot edit email
                    i == "role" ? validateRole("user role", req.body[i], ROLE) :
                        i == "password" ? await validatePassword("user password", req.body[i], 8, 20) :
                            i == "status" ? validateBoolean("user status", req.body[i]) :
                                i == "phone" ? validatePhone("user information phone", req.body[i]) : undefined
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
            } else if (err.meta.target == 'Fullname_UNIQUE') [
                err.message = "full name is duplicated"
            ]
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

        if (user.userinfo.length !== 0) {
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
            console.log(err)
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2003') {
                err.message = "cannot delete user when they have own user or order"
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