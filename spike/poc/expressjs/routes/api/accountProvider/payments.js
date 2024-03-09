const { PrismaClient } = require('@prisma/client')
const express = require('express')
const { generateId } = require('../../model/class/utils/converterUtils')
const router = express.Router()
const { validateStr, validatePhone, validateCode, validateRole } = require('../../validation/body')
const { deleteNullValue } = require('../../model/class/utils/modelMapping')
const { userDetailView } = require('../../model/class/model')
const { notFoundError, forbiddenError } = require('../../model/error/error')
const { ROLE } = require('../../model/enum/role')
const { BANKCODE } = require('../../model/enum/account')
const { JwtAuth } = require('../../../middleware/jwtAuth')

const prisma = new PrismaClient()

// GET - All payment by user name
router.get('/:username', JwtAuth, async (req, res, next) => {
    try {
        // check user by name
        let user = await verifyName(req.params.username)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // find all payment of user
        let payments = await prisma.payments.findMany({
            where: {
                username: user.username
            }
        })

        // map with not null value or undefined value before return on response
        payments = payments.map(payment => deleteNullValue(payment))

        return res.json(payments)
    } catch (err) {
        next(err)
    }
})

// GET - All payment by user name and payment id
router.get('/:username/:paymentId', JwtAuth, async (req, res, next) => {
    try {
        // request data from parameter
        let { username, paymentId } = req.params

        // check user by name
        let user = await verifyName(username)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // get payment detail by payment name and user name
        let payment = await verifypayment(user.username, paymentId)

        return res.json(deleteNullValue(payment))
    } catch (err) {
        next(err)
    }
})

// POST - create user payment
router.post('/', JwtAuth, async (req, res, next) => {
    try {
        // request data from request body
        let { paymentId, bankname, bankCode, bankAccount } = req.body

        // generate Id 32 digit
        let id = paymentId != undefined ? paymentId : generateId(16)
        // console.log(validatePhone("validate payment phone", phone))

        // validate data model
        let paymentModel = {
            paymentId: id,
            username: req.user.username,
            bankname: validateStr("validate bank name", bankname, 100),
            bankCode: validateRole("valiadate bank code", bankCode, BANKCODE),
            bankAccount: validateCode("validate bank account number", bankAccount, 16, [10, 12, 14, 15, 16])
        }

        // create payment and return
        let paymentResponse = await prisma.payments.create({
            data: paymentModel
        })
        return res.json(deleteNullValue(paymentResponse))
    } catch (err) {
        next(err)
    }
})

// PATCH - update user payment by user name and payment id
router.patch('/:username/:paymentId', JwtAuth, async (req, res, next) => {
    try {
        // request data from request body
        let { username, paymentId } = req.params

        // check user by name
        let user = await verifyName(username)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // find user name and payment
        await verifypayment(user.username, paymentId)

        // validate data model
        let mappayment = {}
        for (let i in req.body) {
            if (req.body[i] != undefined) {
                mappayment[i] =
                    i == "bankname" ? validateStr("validate bank name", req.body[i], 100) :
                        i == "bankCode" ? validateStr("validate bank code", req.body[i], 10) :
                            i == "bankAccount" ? validateCode("validate bank account number", req.body[i], 16, [10, 12, 14, 15, 16]) : undefined
            }
        }
        // console.log(mappayment)

        // update payment and return
        let paymentResponse = await prisma.payments.update({
            where: {
                paymentId: paymentId,
                username: username
            },
            data: mappayment
        })
        return res.json(deleteNullValue(paymentResponse))
    } catch (err) {
        next(err)
    }
})

// DELETE - delete user payment by user name and payment id
router.delete('/:username/:paymentId', JwtAuth, async (req, res, next) => {
    try {
        // request data from request body
        let { username, paymentId } = req.params

        // check user by name
        let user = await verifyName(username)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // find user name and payment
        await verifypayment(user.username, paymentId)

        // dalete payment and return
        await prisma.payments.delete({
            where: {
                paymentId: paymentId,
                username: username
            },
        })
        return res.json({ message: "user payment " + paymentId + " in " + username + " has been deleted" })
    } catch (err) {
        next(err)
    }
})

// ----------------------------- method zone -------------------------------------
const verifyName = async (name) => {
    let filter_u = await prisma.accounts.findFirst({
        where: {
            username: validateStr("valiadte user name", name, 100)
        },
        select: userDetailView
    })
    // not found checking
    if (filter_u == null) notFoundError("user name " + name + " does not exist")

    return filter_u
}

const verifypayment = async (name, paymentId) => {
    let payment = await prisma.payments.findFirst({
        where: {
            AND: [
                { username: name },
                { paymentId: paymentId }
            ]
        }
    })
    if (payment == null) notFoundError("user name " + name + " with payment " + paymentId + " does not exist")

    return payment
}

module.exports = router