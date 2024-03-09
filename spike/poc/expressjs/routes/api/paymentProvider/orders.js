let express = require('express')
const { JwtAuth, verifyRole } = require('../../../middleware/jwtAuth')
const { PrismaClient, Prisma } = require('@prisma/client');
const { validateStrArray, validateStr } = require('../../validation/body');
const { generateId, timeConverter, orderConverter } = require('../../model/class/utils/converterUtils');
const { verify, Verify } = require('crypto');
const { notFoundError, forbiddenError } = require('../../model/error/error');
const { ROLE } = require('../../model/enum/role');
let prisma = new PrismaClient()

let router = express.Router()

// get all account order item
router.get('/', JwtAuth, async (req, res) => {
    let addresses = await prisma.addresses.findMany({
        where: {
            username: req.user.username
        }
    })

    let orderList = []
    for (let address of addresses) {
        let orders = await prisma.orders.findMany({
            where: {
                addressId: address.addressId
            },
            include: {
                order_details: true
            }
        })

        if (orders.length !== 0) {
            orders = orders.map(order => {
                console.log(order)
                order.total = order.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
                return orderConverter(order)
            })
            orderList = orders
        }
    }

    return res.json(orderList)
})

// get all supplier order item
router.get('/supplier', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res) => {
    let items = await prisma.items.findMany({
        where: {
            itemOwner: req.user.username
        },
        include: {
            item_details: true
        }
    })

    let item_details = []

    items.forEach(item => {
        item.item_details.forEach(item_detail => {
            item_details.push(item_detail)
        })
    })

    let orderList = []
    for (let item of item_details) {
        let orders = await prisma.order_details.findMany({
            where: {
                itemId: item.itemId,
                itemStyle: item.style,
                itemSize: item.size
            }
        })

        if (orders.length !== 0) {
            orders = orders.map(order => {
                // console.log(order)
                order.total = order.priceEach * order.qtyOrder
                return timeConverter(order)
            })
            orderList = orders
        }
    }

    return res.json(orderList)
})

// get order item id
router.get('/:orderId', JwtAuth, async (req, res, next) => {
    try {
        let order = await verifyOrderId(req.params.orderId)
        order.total = order.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
        return res.json(orderConverter(order))
    } catch (err) {
        next(err)
    }

})

// place order item
router.post('/', JwtAuth, async (req, res, next) => {
    try {
        let { carts, addressId } = req.body

        // find address account
        let accountAddress = await verifyAddressId(validateStr("validate account address", addressId, 32))

        // find cart items
        let selectedCart = await verifyIdByCart(validateStrArray("validate cart item", carts, Infinity, 32).split(","))

        // validate other address place order 
        if (req.user.role !== ROLE.Admin && req.user.username !== accountAddress.username) {
            forbiddenError("user cannot place order by other people except yourself")
        }

        // add order by address and status etc.
        let orderId = generateId(16)
        let order = await prisma.orders.create({
            data: {
                orderId: orderId,
                addressId: validateStr("validate account address", addressId, 32),
                status: "preorder"
            }
        })

        order.order_details = []
        for (let cart of selectedCart) {
            let itemDetail = await verifyId(cart.itemId, cart.itemSize, cart.itemStyle)
            // add order details
            let orderInput = await prisma.order_details.create({
                data: {
                    orderId: orderId,
                    itemStyle: cart.itemStyle,
                    itemId: cart.itemId,
                    itemSize: cart.itemSize,
                    qtyOrder: cart.qty,
                    priceEach: itemDetail.price
                }
            })
            // push orderInput
            order.order_details.push(orderInput)

            // remove all selected cart item
            let mycart = await prisma.carts.findFirst({
                where: {
                    cartId: cart.cartId
                }
            })

            await prisma.carts.delete({
                where: {
                    cartId: mycart.cartId
                }
            })

            await prisma.session_cart.update({
                where: {
                    sessionCartId: mycart.sessionId
                },
                data: {
                    total: {
                        decrement: itemDetail.price*cart.qty
                    }
                }
            })

            // remove item stock per quantity
            await prisma.item_details.update({
                where: {
                    itemId_style_size: {
                        style: cart.itemStyle,
                        itemId: cart.itemId,
                        size: cart.itemSize,
                    }
                },
                data: {
                    stock: {
                        decrement: cart.qty
                    }
                }
            })
        }
        return res.json(orderConverter(order))
    } catch (err) {
        next(err)
    }
})

//----------------------------------------- method zone ----------------------------------------------------

const verifyIdByCart = async (cartId) => {
    let mycart = await prisma.carts.findMany({
        where: {
            cartId: {
                in: cartId
            }
        }
    })
    if (mycart.length == 0) notFoundError("selected item in cart is empty")
    return mycart
}

const verifyId = async (id, size, style) => {
    let items = await prisma.item_details.findFirst({
        where: {
            AND: [
                { itemId: id },
                { size: size },
                { style: style }
            ]
        }
    })
    // if (mycart == null) notFoundError("cart id " + id + " does not exist")
    return items
}

const verifyAddressId = async (addressId) => {
    let myaddress = await prisma.addresses.findFirst({
        where: {
            addressId: addressId
        }
    })
    if (myaddress.length == 0) notFoundError("address id " + addressId + " does not exist")
    return myaddress
}

const verifyOrderId = async (orderId) => {
    let order = await prisma.orders.findFirst({
        where: {
            AND: [
                { orderId: orderId }
            ]
        },
        include: {
            order_details: true
        }
    })
    if (order == null) notFoundError("order id " + orderId + " does not exist")
    return order
}

module.exports = router