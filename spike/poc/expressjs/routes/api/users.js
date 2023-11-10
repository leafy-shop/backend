const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateBoolean, validateEmail, validatePassword, validateRole } = require('../validation/body')
let { notFoundError, validatError, forbiddenError } = require('./../model/error/error')
let { sendMail } = require('./../../config/email_config')

const { JwtAuth, verifyRole } = require('./../../middleware/jwtAuth')
const { ROLE } = require('./../model/enum/role')
const { userView } = require('./../model/class/model')
const { PrismaClient, Prisma } = require('@prisma/client');
const { timeConverter } = require('../model/class/utils/converterUtils');
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
            if(req.user.email !== user.email){
                forbiddenError("you can view yourself only")
            }
        }
        return res.json(user)
    } catch (err) {
        next(err)
    }
})

router.post('/', JwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    let { name, email, role, password } = req.body
    try {
        let input = await prisma.accounts.create({
            data: {
                name: validateStr("name", name, 100),
                email: validateEmail("email", email, 100),
                role: validateRole("role", role, ROLE),
                password: await validatePassword("password", password, 8, 20)
            },
            select: userView
        })
        return res.json(timeConverter(input))
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

router.patch('/:id', JwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    try {
        await verifyId(req.params.id)

        let mapData = {}

        // name: validateStr("name", name, 100),
        // email: validateEmail("email", email, 100),
        // role: validateRole("role", role, ROLE),
        // password: await validatePassword("password", password, 8, 20)
        for (let i in req.body) {
            if (req.body[i] != undefined) {
                mapData[i] =
                    i == "name" ? validateStr("user name", req.body[i], 100) :
                        // i == "email" ? validateEmail("user email", req.body[i], 100) : cannot edit email
                            i == "role" ? validateRole("user role", req.body[i], ROLE) :
                                i == "password" ? await validatePassword("user password", req.body[i], 8, 20) :
                                    i == "status" ? validateBoolean("user status", req.body[i]) : undefined
            }
        }

        let input = await prisma.accounts.update({
            where: {
                userId: validateInt("userId", Number(req.params.id))
            },
            data: mapData,
            select: userView
        })
        return res.json(timeConverter(input))
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

        let input = await prisma.accounts.delete({
            where: {
                userId: validateInt("userId", Number(req.params.id))
            }
        })
        return res.json({message:"user id " + req.params.id + " has been deleted"})
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
        where: {
            userId: validateInt("userId", Number(id))
        },
        select: userView
    })
    // not found checking
    if (filter_u == null) notFoundError("user id " + id + " does not exist")
    return timeConverter(filter_u)
}

module.exports = router