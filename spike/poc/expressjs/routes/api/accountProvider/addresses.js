const { PrismaClient, Prisma } = require('@prisma/client')
const express = require('express')
const { generateIdByMapping } = require('../../model/class/utils/converterUtils')
const router = express.Router()
const { validateStr, validatePhone, validateCode, validateBoolean, validateIdForTesting } = require('../../validation/body')
const { deleteNullValue } = require('../../model/class/utils/modelMapping')
const { userDetailView } = require('../../model/class/model')
const { notFoundError, forbiddenError, validatError } = require('../../model/error/error')
const { ROLE } = require('../../model/enum/role')
const { JwtAuth } = require('../../../middleware/jwtAuth')

const prisma = new PrismaClient()

// GET - All address by user name
router.get('/:username', JwtAuth, async (req, res, next) => {
    try {
        // check user by name
        let user = await prisma.accounts.findFirst({
            where: {
                username: validateStr("valiadte user name", req.user.username, 20)
            },
            select: userDetailView
        })

        // check role and same user name
        if (req.user.role !== ROLE.Admin && req.params.username !== user.username) forbiddenError('This user can see yourself only')

        // console.log(user.username)

        // find all address of user
        let addresses = await prisma.addresses.findMany({
            where: {
                username: req.params.username
            }
        })

        // map with not null value or undefined value before return on response
        addresses = addresses.map(address => deleteNullValue(address))

        return res.json(addresses)
    } catch (err) {
        next(err)
    }
})

// GET - All address by user name and address id
router.get('/:username/:addressId', JwtAuth, async (req, res, next) => {
    try {
        // request data from parameter
        let { username, addressId } = req.params

        // check user by name
        let user = await verifyName(username)

        // check role and same user name
        if (req.user.role !== ROLE.Admin && user.username !== req.user.username) forbiddenError('This user can see yourself only')

        // get address detail by address name and user name
        let address = await verifyAddress(user.username, addressId)

        return res.json(deleteNullValue(address))
    } catch (err) {
        next(err)
    }
})

// POST - create user address
router.post('/:username', JwtAuth, async (req, res, next) => {
    try {
        // request data from request body
        let { addressId, addressname, address, province, distrinct, subDistrinct, postalCode, phone } = req.body
        let { username } = req.params

        if (req.user.role !== ROLE.Admin && req.user.username !== username) {
            forbiddenError('This user can create yourself address only')
        }

        // generate Id 32 digit
        let id = addressId != undefined ? validateIdForTesting(addressId.split("-")[0],addressId.split("-")[1]) : generateIdByMapping(16, username)
        // console.log(validatePhone("validate address phone", phone))

        // validate data model
        let addressModel = {
            addressId: id,
            username: username,
            addressname: validateStr("validate address name", addressname, 100),
            phone: validatePhone("validate address phone", phone),
            address: validateStr("valiadate address", address, 50),
            province: validateStr("validate province", province, 20),
            distrinct: validateStr("validate distrinct", distrinct, 20),
            subDistrinct: validateStr("validate sub distrinct", subDistrinct, 20, true),
            postalCode: validateCode("validate postal code", postalCode, 5),
        }

        // find all address of default user
        let addressDefault = await prisma.addresses.findFirst({
            where: {
                AND: [
                    { username: username },
                    { isDefault: true }
                ]
            }
        })

        // set defualt value when they does not exist
        if (addressDefault === null) {
            addressModel.isDefault = true
        }

        // create address and return
        let addressResponse = await prisma.addresses.create({
            data: addressModel
        })
        return res.status(201).json(deleteNullValue(addressResponse))
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.meta.target === 'PRIMARY') {
                err.message = "address of user is duplicated"
            }
        }
        next(err)
    }
})

// PATCH - update user address by user name and address id
router.patch('/:username/:addressId', JwtAuth, async (req, res, next) => {
    try {
        // request data from request body
        let { username, addressId } = req.params

        // check user by name
        let user = await verifyName(username)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // find user name and address
        await verifyAddress(username, addressId)

        // validate data model
        let mapAddress = {}
        for (let i in req.body) {
            if (req.body[i] != undefined) {
                mapAddress[i] =
                    i == "addressname" ? validateStr("validate address name", req.body[i], 100) :
                        i == "phone" ? validatePhone("validate address phone", req.body[i]) :
                            i == "address" ? validateStr("valiadate address", req.body[i], 50) :
                                i == "province" ? validateStr("validate province", req.body[i], 20) :
                                    i == "distrinct" ? validateStr("validate distrinct", req.body[i], 20) :
                                        i == "subDistrinct" ? validateStr("validate sub distrinct", req.body[i], 20, true) :
                                            i == "postalCode" ? validateCode("validate postal code", req.body[i], 5) :
                                                i == "isDefault" ? validateBoolean("validate is default for account address", req.body[i]) : undefined
            }
        }
        // console.log(mapAddress)
        if (mapAddress.isDefault) {
            await prisma.addresses.updateMany({
                data: {
                    isDefault: false
                },
                where: {
                    username: username
                }
            })
        }

        // update address and return
        let addressResponse = await prisma.addresses.update({
            where: {
                addressId: addressId,
                username: username
            },
            data: mapAddress
        })
        return res.json(deleteNullValue(addressResponse))
    } catch (err) {
        next(err)
    }
})

// DELETE - delete user address by user name and address id
router.delete('/:username/:addressId', JwtAuth, async (req, res, next) => {
    try {
        // request data from request body
        let { username, addressId } = req.params

        // check user by name
        let user = await verifyName(username)

        // check role and same user email
        if (req.user.role !== ROLE.Admin && user.email !== req.user.email) forbiddenError('This user can see yourself only')

        // find user name and address
        let address = await verifyAddress(username, addressId)

        // mandatory cannot delete default selection
        if (address.isDefault) {
            validatError("cannot delete default selection of your address")
        // dalete address and return    
        } else {
            await prisma.addresses.delete({
                where: {
                    addressId: addressId,
                    username: username
                },
            })
        }

        return res.json({ message: "user address " + addressId + " in " + username + " has been deleted" })
    } catch (err) {
        next(err)
    }
})

// ----------------------------- method zone -------------------------------------
const verifyName = async (name) => {
    let filter_u = await prisma.accounts.findFirst({
        where: {
            username: validateStr("valiadte user name", name, 20)
        },
        select: userDetailView
    })
    // not found checking
    if (filter_u == null) notFoundError("user name " + name + " does not exist")

    return filter_u
}

const verifyAddress = async (name, addressId) => {
    let address = await prisma.addresses.findFirst({
        where: {
            AND: [
                { username: name },
                { addressId: addressId }
            ]
        }
    })
    if (address == null) notFoundError("user name " + name + " with address " + addressId + " does not exist")

    return address
}

module.exports = router