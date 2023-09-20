const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateBoolean, validateEmail, validatePassword, validateRole } = require('../validation/body')
let { notFoundError, validatError } = require('./../model/error/error')
let { sendMail } = require('./../../config/email_config')

const { JwtAuth, verifyRole } = require('./../../middleware/jwtAuth')
const { ROLE } = require('./../model/enum/role')

const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

// Exclude keys from user
const user = {
    userId: true,
    name: true,
    email: true,
    role: true,
    createdAt: true,
    updatedAt: true
}

router.get('/', JwtAuth, verifyRole(ROLE.Admin), async (req, res) => {
    let sorting = req.query.sort == 'desc' ? 'desc' : 'asc'
    console.log(req.query.name)
    let page = Number(req.query.page)
    let limit = Number(req.query.limit)
    let count_user = await prisma.users.count()
    let filter_u = await prisma.users.findMany({
        skip: page > 0 ? (page - 1) * limit : 0,
        take: limit > 1 ? limit : count_user,
        where: {
            AND: [
                {
                    OR: [{
                        name: {
                            contains: req.query.name
                        },
                        email: {
                            contains: req.query.email
                        }
                    }]
                }, {
                    role: req.query.role
                }
            ]
        },
        select: user,
        orderBy: { updatedAt: sorting }
    })
    return res.json(filter_u)
})

router.get('/:id', JwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    try {
        sendMail("test massage","test",req.user.email)
        return res.json(await verifyId(req.params.id))
    } catch (err) {
        next(err)
    }
})

router.post('/', JwtAuth, verifyRole(ROLE.Admin), async (req, res, next) => {
    let { name, email, role, password } = req.body
    try {
        let input = await prisma.users.create({
            data: {
                name: validateStr("name", name, 100),
                email: validateEmail("email", email, 100),
                role: validateRole("role", role, ROLE),
                password: await validatePassword("password", password, 8, 20)
            },
            select: user
        })
        return res.json(input)
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

        for (let i in req.body) {
            if (req.body[i] != undefined) {
                mapData[i] = i == "name" ? validateStr(i, req.body[i], 100) :
                    i == "email" ? validateEmail(i, req.body[i], 100) :
                        i == "role" ? validateRole(i, req.body[i], ROLE) :
                            await validatePassword(i, req.body[i], 8, 20)
            }
        }

        let input = await prisma.users.update({
            where: {
                userId: validateInt("userId", Number(req.params.id))
            },
            data: mapData,
            select: user
        })
        return res.json(input)
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
        await verifyId(req.params.id)

        let input = await prisma.users.delete({
            where: {
                userId: validateInt("userId", Number(req.params.id))
            }
        })
        return res.json("user id" + req.params.id + " has deleted")
    } catch (err) {
        next(err)
    }
})

const verifyId = async (id) => {
    let filter_u = await prisma.users.findFirst({
        where: {
            userId: validateInt("userId", Number(id))
        },
        select: user
    })
    if (filter_u == null) notFoundError("user id " + id + " does not exist")
    return filter_u
}


module.exports = router