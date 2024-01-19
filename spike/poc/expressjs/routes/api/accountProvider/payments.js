const { PrismaClient } = require('@prisma/client')
const express = require('express')
const { generateId } = require('../../model/class/utils/converterUtils')
const router = express.Router()
const { validateStr, validatePhone, validateCode, validateRole } = require('../../validation/body')
const { deleteNullValue } = require('../../model/class/utils/modelMapping')
const { userDetailView } = require('../../model/class/model')
const { notFoundError, forbiddenError } = require('../../model/error/error')
const { ROLE } = require('../../model/enum/role')
const { BANKCODE } = require('../../model/enum/bankCode')
const { JwtAuth } = require('../../../middleware/jwtAuth')

const prisma = new PrismaClient()

// GET - All payment by user email
router.get('/:userEmail', JwtAuth, async (req, res, next) => {
    try {
        // check user by email
        let user = await verifyEmail(req.params.userEmail)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // find all payment of user
        let payments = await prisma.payments.findMany({
            where: {
                userEmail: user.email
            }
        })

        // map with not null value or undefined value before return on response
        payments = payments.map(payment => deleteNullValue(payment))

        return res.json(payments)
    } catch (err) {
        next(err)
    }
})

// GET - All payment by user email and payment id
router.get('/:userEmail/:paymentId', JwtAuth, async (req, res, next) => {
    try {
        // request data from parameter
        let { userEmail, paymentId } = req.params

        // check user by email
        let user = await verifyEmail(userEmail)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // get payment detail by payment email and user email
        let payment = await verifypayment(user.email, paymentId)

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
            userEmail: req.user.email,
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

// PATCH - update user payment by user email and payment id
router.patch('/:userEmail/:paymentId', JwtAuth, async (req, res, next) => {
    try {
        // request data from request body
        let { userEmail, paymentId } = req.params

        // check user by email
        let user = await verifyEmail(userEmail)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // find user email and payment
        await verifypayment(user.email, paymentId)

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
                userEmail: userEmail
            },
            data: mappayment
        })
        return res.json(deleteNullValue(paymentResponse))
    } catch (err) {
        next(err)
    }
})

// DELETE - delete user payment by user email and payment id
router.delete('/:userEmail/:paymentId', JwtAuth, async (req, res, next) => {
    try {
        // request data from request body
        let { userEmail, paymentId } = req.params

        // check user by email
        let user = await verifyEmail(userEmail)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // find user email and payment
        await verifypayment(user.email, paymentId)

        // dalete payment and return
        await prisma.payments.delete({
            where: {
                paymentId: paymentId,
                userEmail: userEmail
            },
        })
        return res.json({ message: "user payment " + paymentId + " in " + userEmail + " has been deleted" })
    } catch (err) {
        next(err)
    }
})

// ----------------------------- method zone -------------------------------------
const verifyEmail = async (email) => {
    let filter_u = await prisma.accounts.findFirst({
        where: {
            email: validateStr("valiadte user email", email, 100)
        },
        select: userDetailView
    })
    // not found checking
    if (filter_u == null) notFoundError("user email " + email + " does not exist")

    return filter_u
}

const verifypayment = async (email, paymentId) => {
    let payment = await prisma.payments.findFirst({
        where: {
            AND: [
                { userEmail: email },
                { paymentId: paymentId }
            ]
        }
    })
    if (payment == null) notFoundError("user email " + email + " with payment " + paymentId + " does not exist")

    return payment
}

module.exports = router