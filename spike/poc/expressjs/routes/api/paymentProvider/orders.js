let express = require('express')
const { JwtAuth, verifyRole } = require('../../../middleware/jwtAuth')
const { PrismaClient } = require('@prisma/client');
const { validateStrArray, validateStr } = require('../../validation/body');
const { orderConverter, orderDetailConverter, paginationList, generateIdByMapping } = require('../../model/class/utils/converterUtils');
const { notFoundError, forbiddenError } = require('../../model/error/error');
const { ROLE } = require('../../model/enum/role');
const { ITEMEVENT } = require('../../model/enum/item');
const { ORDERSTATUS } = require('../../model/enum/order');
let prisma = new PrismaClient()

let router = express.Router()

// get all account order item
router.get('/', JwtAuth, async (req, res) => {
    let { sort } = req.query

    // get all order list
    let orderList = []

    // get all item orders by address Id sort by created at
    let orders = await prisma.orders.findMany({
        where: {
            addressId: {
                contains: req.user.username
            }
        },
        include: {
            order_details: true
        },
        orderBy: {
            createdAt: sort === "asc" ? "asc" : "desc"
        }
    })

    if (orders.length !== 0) {
        orders = orders.map(order => {
            // console.log(order)
            // order.total = order.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
            return orderConverter(order)
        })
        orderList = orders
    }

    return res.json(orderList)
})

// get all supplier order item or order audit
router.get('/supplier', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res) => {
    let { sort, itemId, username, page, limit } = req.query

    let pageN = Number(page)
    let limitN = Number(limit)
    itemId = itemId ? Number(itemId) : { gt: 0 }

    // filter item by customize itemId
    let orders = await prisma.order_details.findMany({
        where: {
            itemId: itemId
        },
        orderBy: {
            createdAt: sort === "asc" ? "asc" : "desc"
        }
    })

    // filter supplier owner and customer name
    orders = orders.filter(order => {
        return order.orderId.split("-")[0] === req.user.username && (!username || order.orderId.split("-")[1] === username)
    })

    // order format
    if (orders.length !== 0) {
        orders = orders.map(order => {
            // console.log(order)
            order.total = order.priceEach * order.qtyOrder
            return orderDetailConverter(order)
        })
    }

    let page_order = paginationList(orders, pageN, limitN, 20)

    return res.json(page_order)
})

// get order item by address id
router.get('/addresses/:addressId', JwtAuth, async (req, res, next) => {
    try {
        let orders = await verifyOrderIdByAddress(req.params.addressId)

        // if they are user or garden designer role
        if ([ROLE.User, ROLE.GD_DESIGNER].includes(req.user.role) && orders.orderId.split("-")[1] !== req.user.username) {
            forbiddenError("you cannot see order in other user except yourself")
        }

        // if they are supplier role
        if (req.user.role === ROLE.Supplier && orders.orderId.split("-")[0] !== req.user.username) {
            forbiddenError("you cannot see order in other user except yourself and your item order")
        }

        orders = orders.map(order => {
            order.total = order.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
            return orderConverter(order)
        })

        return res.json(orders)
    } catch (err) {
        next(err)
    }
})

// get order item by order id
router.get('/:orderId', JwtAuth, async (req, res, next) => {
    try {
        let orders = await verifyOrderId(req.params.orderId)

        // if they are user or garden designer role
        if ([ROLE.User, ROLE.GD_DESIGNER].includes(req.user.role) && orders.orderId.split("-")[1] !== req.user.username) {
            forbiddenError("you cannot see order in other user except yourself")
        }

        // if they are supplier role
        if (req.user.role === ROLE.Supplier && orders.orderId.split("-")[0] !== req.user.username) {
            forbiddenError("you cannot see order in other user except yourself and your item order")
        }

        orders.total = orders.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
        return res.json(orderConverter(orders))
    } catch (err) {
        next(err)
    }
})

// place order item
router.post('/', JwtAuth, async (req, res, next) => {
    try {
        let { carts, addressId } = req.body

        // find address account
        let accountAddress = await verifyAddressId(validateStr("validate account address", addressId, 53))

        // find cart items
        let selectedSession = await verifyIdByCartGroup(validateStrArray("validate cart item", carts, Infinity, 53).split(","))

        let mycart = await prisma.carts.findMany({
            where: {
                cartId: {
                    in: carts
                }
            }
        })

        // console.log(selectedSession)

        // validate other address place order 
        if (req.user.role !== ROLE.Admin && req.user.username !== accountAddress.username) {
            forbiddenError("user cannot place order by other people except yourself")
        }

        mycart.forEach(cart => {
            if (req.user.role !== ROLE.Admin && cart.sessionId.split("-")[0] !== req.user.username) {
                forbiddenError("you cannot paid with other carts except yourself")
            }
        })

        let orders = {}
        for (let selectOwner in selectedSession) {
            // add order by address and status etc.
            let orderId = `${selectedSession[selectOwner].sessionId.split("-")[0]}-${generateIdByMapping(16, req.user.username)}`
            await prisma.orders.create({
                data: {
                    orderId: orderId,
                    addressId: validateStr("validate account address", addressId, 53),
                    status: ORDERSTATUS.PENDING
                }
            })

            // find selected cart
            let selectedCart = mycart.filter(cart => cart.sessionId === selectedSession[selectOwner].sessionId)
            let orderDetails = []
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
                orderDetails.push(orderDetailConverter(orderInput))

                // add to cart on item event behaviour
                await prisma.item_events.create({
                    data: {
                        itemId: cart.itemId,
                        userId: req.user.id,
                        itemEvent: ITEMEVENT.PAID
                    }
                })

                // remove all selected cart item
                let mycart = await prisma.carts.findFirst({
                    where: {
                        cartId: cart.cartId
                    }
                })

                // delete cart
                await prisma.carts.delete({
                    where: {
                        cartId: mycart.cartId
                    }
                })

                // delete session cart
                await prisma.session_cart.update({
                    where: {
                        sessionCartId: mycart.sessionId
                    },
                    data: {
                        total: {
                            decrement: itemDetail.price * cart.qty
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
                orders[selectedSession[selectOwner].sessionId.split("-")[0]] = orderDetails
                console.log(orders)
            }

            // mandatory delete item when item have not price in cart
            await prisma.session_cart.deleteMany({
                where: {
                    total: 0
                }
            })
        }

        return res.status(201).json(orders)
    } catch (err) {
        next(err)
    }
})

// get order item by order id
router.get('/:orderId', JwtAuth, async (req, res, next) => {
    try {
        let order = await verifyOrderId(req.params.orderId)
        order.total = order.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
        return res.json(orderConverter(order))
    } catch (err) {
        next(err)
    }
})

//----------------------------------------- method zone ----------------------------------------------------

const verifyIdByCartGroup = async (cartId) => {
    let mycart = await prisma.carts.groupBy({
        by: ["sessionId"],
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
    if (myaddress == null) notFoundError("address id " + addressId + " does not exist")
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

const verifyOrderIdByAddress = async (addressId) => {
    let order = await prisma.orders.findMany({
        where: {
            AND: [
                { addressId: addressId }
            ]
        },
        include: {
            order_details: true
        }
    })
    if (order.length === 0) notFoundError("order id " + addressId + " does not exist")
    return order
}

module.exports = router