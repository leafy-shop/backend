let express = require('express')
const { JwtAuth, verifyRole } = require('../../../middleware/jwtAuth')
const { PrismaClient, Prisma } = require('@prisma/client');
const { validateStrArray, validateStr, validateRole, validateDatetimeFuture, validateIdForTesting, validateInt } = require('../../validation/body');
const { orderConverter, orderDetailConverter, paginationList, generateIdByMapping } = require('../../model/class/utils/converterUtils');
const { notFoundError, forbiddenError, validatError } = require('../../model/error/error');
const { ROLE } = require('../../model/enum/role');
const { ITEMEVENT } = require('../../model/enum/item');
const { ORDERSTATUS } = require('../../model/enum/order');
const { orderView } = require('../../model/class/model');
const { listFirstImage, findImagePath } = require('../../model/class/utils/imageList');
let prisma = new PrismaClient()

let router = express.Router()

// get all account order item
router.get('/', JwtAuth, async (req, res) => {
    let { ownerItemOrProduct, status, sort, page, limit } = req.query

    let pageN = Number(page)
    let limitN = Number(limit)

    // get all item orders by address Id sort by created at
    let orders = await prisma.orders.findMany({
        where: {
            status: status
        },
        select: orderView,
        orderBy: {
            createdAt: sort === "asc" ? "asc" : "desc"
        }
    })

    orders = orders.filter(order => {
        return order.customerName === req.user.username
    })

    // get all order list
    orders = await Promise.all(orders.map(async order => {
        order.total = parseFloat(order.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)).toFixed(2)
        order.order_details = await Promise.all(order.order_details.map(async od => {
            let item = await verifyItemId(od.itemId)
            od.itemname = item.name
            od.image = await listFirstImage(findImagePath("products", od.itemId), "main.png")
            return od
        }))
        return orderConverter(order)
    }))

    // filter owner name or order details as itemname 
    orders = orders.filter(order => {
        return (ownerItemOrProduct !== undefined ? order.orderId.split("-")[0].includes(ownerItemOrProduct) || order.order_details.some(od => od.itemname.includes(ownerItemOrProduct)) : true)
    })

    let page_order = paginationList(orders, pageN, limitN, 10)

    return res.json(page_order)
})

// get all supplier order item or order audit
router.get('/supplier', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res) => {
    let { sort, itemId, username, status, page, limit } = req.query

    let pageN = Number(page)
    let limitN = Number(limit)

    // filter item by customize itemId
    let orders = []
    if (Number(itemId) > 0) {
        orders = await prisma.orders.findMany({
            where: {
                status: status
            },
            include: {
                order_details: true
            },
            orderBy: {
                createdAt: sort === "asc" ? "asc" : "desc"
            }
        })
    } else {
        orders = await prisma.orders.findMany({
            where: {
                itemId: itemId
            },
            include: {
                order_details: true
            },
            orderBy: {
                createdAt: sort === "asc" ? "asc" : "desc"
            }
        })
    }

    // filter supplier owner and customer name
    orders = orders.filter(order => {
        return order.orderId.split("-")[0] === req.user.username && (!username || order.customerName === username)
    })

    // order format
    if (orders.length !== 0) {
        orders = await Promise.all(orders.map(async order => {
            // console.log(order)
            order.total = parseFloat(order.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)).toFixed(2)
            order.order_details = await Promise.all(order.order_details.map(async od => {
                let item = await verifyItemId(od.itemId)
                od.itemname = item.name
                return od
            }))
            return orderConverter(order)
        }))
    }

    let page_order = paginationList(orders, pageN, limitN, 10)

    return res.json(page_order)
})

// get order item by address id
// router.get('/addresses/:addressId', JwtAuth, async (req, res, next) => {
//     try {
//         let { status, sort, page, limit } = req.query

//         let pageN = Number(page)
//         let limitN = Number(limit)

//         // list addresses
//         let address = await prisma.addresses.findFirst({
//             where: {
//                 addressId: req.params.addressId
//             }
//         })
//         // console.log(address)

//         // validate authorization when see other address
//         if (address.addressId.split("-")[0] !== req.user.username) {
//             forbiddenError("you cannot see order in other addresses except owner addresses only")
//         }

//         // list orders
//         let orders = []
//         if (address !== null) {
//             orders = await prisma.orders.findMany({
//                 where: {
//                     AND: [
//                         { addressId: address.addressId },
//                         { status: status },
//                     ]
//                 },
//                 include: {
//                     order_details: true
//                 },
//                 orderBy: {
//                     createdAt: sort === "asc" ? "asc" : "desc"
//                 }
//             })

//             if (req.user.role === ROLE.Supplier && (orders.orderId.split("-")[0] === req.user.username || orders.orderId.split("-")[1] !== req.user.username)) {
//                 forbiddenError("you cannot see order in other user except yourself and your item order")
//             }

//             orders = orders.map(order => {
//                 order.total = order.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
//                 return orderConverter(order)
//             })
//         }

//         let page_order = paginationList(orders, pageN, limitN, 10)

//         return res.json(page_order)
//     } catch (err) {
//         next(err)
//     }
// })

// get order item by order id
router.get('/:orderId', JwtAuth, async (req, res, next) => {
    try {
        let order = await verifyOrderId(req.params.orderId)

        // if they are user or garden designer role
        if (ROLE.Admin !== req.user.role && order.customerName !== req.user.username) {
            forbiddenError("you cannot see order in other user except yourself")
        }

        // if they are supplier role
        // console.log(order.orderId.split("-")[0])
        // console.log(order.orderId.split("-")[1])
        if (req.user.role === ROLE.Supplier && (order.orderId.split("-")[0] === req.user.username || order.orderId.split("-")[1] !== req.user.username)) {
            forbiddenError("you cannot see order in other user except yourself or your item order")
        }

        order.total = parseFloat(order.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)).toFixed(2)
        order.order_details = await Promise.all(order.order_details.map(async od => {
            od.image = await listFirstImage(findImagePath("products", od.itemId), "main.png")
            return od
        }))

        return res.json(orderConverter(order))
    } catch (err) {
        next(err)
    }
})

// place order item
router.post('/', JwtAuth, async (req, res, next) => {
    try {
        let { orderBodyId, carts, addressId } = req.body

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

        // validate some cart in owner item
        for (const cart of mycart) {
            if (req.user.role !== ROLE.Admin && cart.sessionId.split("-")[0] === req.user.username) {
                forbiddenError("you cannot pay with your own cart");
            }

            const stock = await prisma.item_details.findFirst({
                select: {
                    stock: true
                },
                where: {
                    AND: [
                        { itemId: cart.itemId },
                        { style: cart.itemStyle },
                        { size: cart.itemSize }
                    ]
                }
            });

            if (cart.qty > stock.stock) {
                validatError("you cannot pay order when your quantity in cart is more than quantity in item stock");
            }
        }

        // edited address
        let addressFormat = (accountAddress.subDistrinct !== undefined ? `${accountAddress.address} ${accountAddress.subDistrinct} ${accountAddress.distrinct} ${accountAddress.province} ${accountAddress.postalCode}` :
            `${accountAddress.address} ${accountAddress.distrinct} ${accountAddress.province} ${accountAddress.postalCode}`)

        let orders = {}
        for (let selectOwner in selectedSession) {
            // add order by address and status etc.
            let orderId = orderBodyId !== undefined ? validateIdForTesting(selectedSession[selectOwner].sessionId.split("-")[0], orderBodyId) : generateIdByMapping(16, selectedSession[selectOwner].sessionId.split("-")[0])
            await prisma.orders.create({
                data: {
                    orderId: orderId,
                    customerName: accountAddress.username,
                    address: addressFormat,
                    status: ORDERSTATUS.PENDING
                }
            })

            // find selected cart
            let selectedCart = mycart.filter(cart => cart.sessionId === selectedSession[selectOwner].sessionId)
            let orderDetails = []
            let totalPrice = 0
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
                totalPrice += itemDetail.price * cart.qty
            }
            // console.log(totalPrice)

            // delete session cart
            await prisma.session_cart.update({
                where: {
                    sessionCartId: selectedSession[selectOwner].sessionId
                },
                data: {
                    total: {
                        decrement: totalPrice
                    }
                }
            })

            // delete session cart
            let carts = await prisma.carts.findMany({
                where: {
                    sessionId: selectedSession[selectOwner].sessionId
                }
            })

            if (carts.length === 0) {
                await prisma.session_cart.delete({
                    where: { sessionCartId: selectedSession[selectOwner].sessionId }
                })
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
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.meta.target === 'PRIMARY') {
                err.message = "order of user is duplicated"
            }
        }
        next(err)
    }
})

// pay item without cart on order item
router.post('/no_cart', JwtAuth, async (req, res, next) => {
    try {
        let { orderBodyId, itemId, style, size, qty, addressId } = req.body

        // find address account
        let accountAddress = await verifyAddressId(validateStr("validate account address", addressId, 53))

        // find cart items
        let item = await verifyItemId(Number(itemId))
        qty = qty ? validateInt("item quantity",qty, false, 1) : 1
        let selectedItem = await verifyId(item.itemId, size, style)
        if (selectedItem == null) notFoundError("size and style of item id " + itemId + " does not exist")

        // validate other address place order
        if (req.user.role !== ROLE.Admin && req.user.username !== accountAddress.username) {
            forbiddenError("user cannot place order by other people except yourself")
        }

        // validate some order in owner item
        if (req.user.role === ROLE.Supplier && req.user.username === item.itemOwner) {
            forbiddenError("supplier user cannot place order by other people except yourself")
        }

        // validate quantity cart in item stock
        if (qty > selectedItem.stock) {
            validatError("you cannot pay order when your quantity in cart is more than quantity in item stock");
        }

        // edited address
        let addressFormat = (accountAddress.subDistrinct !== undefined ? `${accountAddress.address} ${accountAddress.subDistrinct} ${accountAddress.distrinct} ${accountAddress.province} ${accountAddress.postalCode}` :
            `${accountAddress.address} ${accountAddress.distrinct} ${accountAddress.province} ${accountAddress.postalCode}`)

        // add order by address and status etc.
        let orderId = orderBodyId !== undefined ? validateIdForTesting(item.itemOwner, orderBodyId) : generateIdByMapping(16, item.itemOwner)
        let orderInput = await prisma.orders.create({
            data: {
                orderId: orderId,
                customerName: accountAddress.username,
                address: addressFormat,
                status: ORDERSTATUS.PENDING
            }
        })

        // find selected cart
        let order_detail = await prisma.order_details.create({
            data: {
                orderId: orderId,
                itemStyle: style,
                itemId: item.itemId,
                itemSize: size,
                qtyOrder: qty,
                priceEach: selectedItem.price
            }
        })

        // map model
        orderInput.order_details = []
        orderInput.order_details.push(order_detail)

        // add to cart on item event behaviour
        await prisma.item_events.create({
            data: {
                itemId: item.itemId,
                userId: req.user.id,
                itemEvent: ITEMEVENT.PAID
            }
        })

        // remove item stock per quantity
        await prisma.item_details.update({
            where: {
                itemId_style_size: {
                    style: style,
                    itemId: item.itemId,
                    size: size
                }
            },
            data: {
                stock: {
                    decrement: qty
                }
            }
        })
        return res.status(201).json(orderConverter(orderInput))
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.meta.target === 'PRIMARY') {
                err.message = "order of user is duplicated"
            }
        }
        next(err)
    }
})

// changing order status
router.put('/prepare_order/:orderId', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    try {
        let order = await verifyOrderId(req.params.orderId)

        // if they are supplier role
        if (req.user.role === ROLE.Supplier && order.orderId.split("-")[0] !== req.user.username) {
            forbiddenError("you cannot see order in other user except yourself and your item order")
        }

        let { orderStatus, shippedDate } = req.body

        orderStatus = validateRole("validate order status", orderStatus, ORDERSTATUS, false)

        // before transit
        if (orderStatus === ORDERSTATUS.INPROGRESS) {
            updatedOrder = await prisma.orders.update({
                data: {
                    status: ORDERSTATUS.INPROGRESS,
                    shippedDate: validateDatetimeFuture("validate shipped date", shippedDate, false, true)
                },
                where: {
                    orderId: order.orderId
                },
                include: {
                    order_details: true
                }
            })
            updatedOrder.total = updatedOrder.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
            return res.json(orderConverter(updatedOrder))
        } else {
            validatError("supplier must prepared product for transit to user only")
        }
    } catch (err) {
        next(err)
    }
})

// changing order status
router.put('/check_order/:orderId', JwtAuth, async (req, res, next) => {
    try {
        let order = await verifyOrderId(req.params.orderId)
        let { orderStatus } = req.body

        orderStatus = validateRole("validate order status", orderStatus, ORDERSTATUS, false)

        let updatedOrder = {}

        // checkout order when send to customer
        if (order.customerName === req.user.username && orderStatus === ORDERSTATUS.COMPLETED) {
            if (order.status === ORDERSTATUS.INPROGRESS) {
                updatedOrder = await prisma.orders.update({
                    data: {
                        status: ORDERSTATUS.COMPLETED
                    },
                    where: {
                        orderId: order.orderId
                    },
                    include: {
                        order_details: true
                    }
                })
                updatedOrder.total = updatedOrder.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
                return res.json(orderConverter(updatedOrder))
            } else {
                validatError("supplier must be prepared receive item before send to customer")
            }
            // cancel order
        } else if (order.customerName === req.user.username && orderStatus === ORDERSTATUS.CANCELED) {
            if (order.status !== ORDERSTATUS.COMPLETED) {
                updatedOrder = await prisma.orders.update({
                    data: {
                        status: ORDERSTATUS.CANCELED
                    },
                    where: {
                        orderId: order.orderId
                    },
                    include: {
                        order_details: true
                    }
                })
                updatedOrder.total = updatedOrder.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
                return res.json(orderConverter(updatedOrder))
            } else {
                validatError("customer cannot canceled after complete to recieve item")
            }
        } else {
            forbiddenError("supplier cannot edit order item when consumer confirm purchase or cancel product")
        }
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

const verifyItemId = async (id) => {
    let items = await prisma.items.findFirst({
        where: {
            itemId: id
        }
    })
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
        select: orderView
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