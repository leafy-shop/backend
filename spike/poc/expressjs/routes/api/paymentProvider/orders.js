let express = require('express')
const { JwtAuth, verifyRole } = require('../../../middleware/jwtAuth')
const { PrismaClient, Prisma } = require('@prisma/client');
const { validateStrArray, validateStr, validateRole, validateDatetimeFuture, validateIdForTesting, validateInt, validateDatetime } = require('../../validation/body');
const { orderConverter, orderDetailConverter, paginationList, generateOrderId } = require('../../model/class/utils/converterUtils');
const { notFoundError, forbiddenError, validatError } = require('../../model/error/error');
const { ROLE } = require('../../model/enum/role');
const { ITEMEVENT } = require('../../model/enum/item');
const { ORDERSTATUS } = require('../../model/enum/order');
const { orderView, orderDetailView } = require('../../model/class/model');
const { listFirstImage, findImagePath } = require('../../model/class/utils/imageList');
const { addHours } = require('../../model/class/utils/datetimeUtils');
// const { escapeXML } = require('ejs');
// Requiring the lodash library 
// const _ = require("lodash");
// const QRCode = require('qrcode')
// const generatePayload = require('promptpay-qr')
let prisma = new PrismaClient()

let router = express.Router()

// get all account order item
router.get('/', JwtAuth, async (req, res, next) => {
    let { search, status, sort, page, limit } = req.query

    let pageN = Number(page)
    let limitN = Number(limit)

    try {
        // get all item orders by address Id sort by created at
        let orders = await prisma.orders.findMany({
            where: {
                AND: [
                    { status: status }
                ]
            },
            select: orderView,
            orderBy: {
                createdAt: sort === "asc" ? "asc" : "desc"
            }
        })

        // console.log(groupOrder)
        // get all item orders by address Id sort by created at
        if (req.user.role !== ROLE.Admin) {
            orders = orders.filter(order => {
                return order.customerName === req.user.username
            })
        }

        // get all order list
        orders = await Promise.all(orders.map(async order => {
            let user = await prisma.accounts.findFirst({
                where: {
                    username: order.orderId.split("-")[0]
                }
            })
            order.supplierId = user.userId
            order.itemOwner = order.orderId.split("-")[0]
            
            order.isOutStock = true
            order.address = undefined

            order.order_details = await Promise.all(order.order_details.map(async od => {
                let item = await verifyItemId(od.itemId)
                od.itemname = item.name
                od.priceEach = Number(od.priceEach)
                let itemReview = await verifyReviewId(od.orderId, od.itemId, od.itemStyle, od.itemSize)
                od.rating = itemReview ? (itemReview.PQrating + itemReview.SSrating + itemReview.DSrating) / 3 : 0
                od.subTotal = od.priceEach * od.qtyOrder
                od.image = await listFirstImage(findImagePath("products", od.itemId), "main.png")
                let itemDetail = await verifyId(od.itemId, od.itemSize, od.itemStyle)
                if (itemDetail !== null && itemDetail.stock > 0) {
                    order.isOutStock = false
                }
                return od
            }))
            return orderConverter(order)
        }))

        // filter owner name or order details as itemname 
        orders = orders.filter(order => {
            return (search !== undefined ? order.orderId.split("-")[0].toLowerCase().includes(search.toLowerCase()) || order.order_details.some(od => od.itemname.toLowerCase().includes(search.toLowerCase())) : true)
        })

        let groupOrder = new Set()
        orders.forEach(order => groupOrder.add(order.orderGroupId))

        // console.log(orders.length)
        // console.log(groupOrder)

        let resultOrder = []
        for (let groupOrderId of groupOrder) {
            let orderModel = {}
            orderModel.orderGroupId = groupOrderId
            orderModel.orders = orders.filter(od => od.orderGroupId === groupOrderId)
            if (orderModel.orders.every(order => order.status === ORDERSTATUS.REQUIRED)) {
                orderModel.total = orderModel.orders.reduce((pre,cur) => pre + cur.order_details.reduce((pre,order) => pre + order.subTotal, 0), 0)
                resultOrder.push(orderModel)
            } else {
                orderModel.orders.forEach(order => {
                    order.total = order.order_details.reduce((pre,cur) => pre + cur.subTotal, 0)
                    resultOrder.push(order)
                })
            }
        }

        // let resultOrder = []
        // for (let order of orders) {
        //     let orderModel = {}
        //     groupOrder.forEach(groupOrderId => {
        //         if (order.orderGroupId == groupOrderId.orderGroupId) {
        //             // check order status payment and other status
        //             if (order.status === ORDERSTATUS.REQUIRED) {
        //                 let orderGroupRequired = orders.filter(order => order.orderGroupId == groupOrderId.orderGroupId && order.status === ORDERSTATUS.REQUIRED)
        //                 orderModel = {
        //                     orderGroupId: order.orderGroupId, orders: orderGroupRequired, 
        //                     total: orderGroupRequired.reduce((pre, cur) => pre + cur.total, 0), 
        //                     totalQty: orderGroupRequired.reduce((pre, cur) => pre + cur.order_details.reduce((pre1,cur1)=>pre1 + cur1.qtyOrder,0), 0)
        //                 }
        //             } else {
        //                 orderModel = order
        //             }
        //         }
        //     })
        //     resultOrder.push(orderModel)
        // }

        // // remove duplicate order group
        // resultOrder = resultOrder.filter((value, index) => {
        //     const _value = JSON.stringify(value);
        //     return index === resultOrder.findIndex(obj => {
        //         return JSON.stringify(obj) === _value;
        //     });
        // });

        // using to page
        let page_order = paginationList(resultOrder, pageN, limitN, 10)

        return res.json(page_order)
    } catch (err) {
        next(err)
    }
})



// count all customer order item with status
router.get('/count/:status', JwtAuth, async (req, res, next) => {
    let { status } = req.params

    try {
        // console.log(validateDatetimeFuture("validate date end", new Date(dateEnd), true))

        // filter item by customize itemId
        let orders = []
        if (status === "all") {
            orders = await prisma.orders.findMany()
        } else {
            orders = await prisma.orders.findMany({
                where: {
                    status: status
                }
            })
        }

        // filter supplier owner
        orders = orders.filter(order => {
            return order.customerName === req.user.username
        })
        // console.log(orders)

        return res.json({ count: orders.length })
    } catch (err) {
        next(err)
    }
})

// get all supplier order item or order audit
router.get('/supplier', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    let { sort, status, dateStart, dateEnd, page, limit } = req.query

    let pageN = Number(page)
    let limitN = Number(limit)

    try {
        // console.log(validateDatetimeFuture("validate date end", new Date(dateEnd), true))

        // filter item by customize itemId
        let orders = []
        orders = await prisma.orders.findMany({
            where: {
                AND: [
                    { status: status },
                    {
                        createdAt: {
                            gte: validateDatetime("validate date start", dateStart, true),
                            lte: validateDatetime("validate date end", dateEnd, true)
                        }
                    }
                ]
            },
            include: {
                order_details: true
            },
            orderBy: {
                createdAt: sort === "asc" ? "asc" : "desc"
            }
        })

        // filter supplier owner
        orders = orders.filter(order => {
            return order.orderId.split("-")[0] === req.user.username
        })

        // order format
        if (orders.length !== 0) {
            orders = await Promise.all(orders.map(async order => {
                // console.log(order)
                order.order_details = await Promise.all(order.order_details.map(async od => {
                    let item = await verifyItemId(od.itemId)
                    od.priceEach = Number(od.priceEach)
                    od.subTotal = od.priceEach * od.qtyOrder
                    od.itemname = item.name
                    return od
                }))
                order.total = order.order_details.reduce((pre, order) => pre + order.subTotal, 0)
                return orderConverter(order)
            }))
        }

        let page_order = paginationList(orders, pageN, limitN, 10)

        return res.json(page_order)
    } catch (err) {
        next(err)
    }
})

// count all supplier order item with status
router.get('/supplier/count/:status', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    let { status } = req.params

    try {
        // console.log(validateDatetimeFuture("validate date end", new Date(dateEnd), true))

        // filter item by customize itemId
        let orders = []
        if (status === "all") {
            orders = await prisma.orders.findMany()
        } else {
            orders = await prisma.orders.findMany({
                where: {
                    status: status
                }
            })
        }

        // filter supplier owner
        orders = orders.filter(order => {
            return order.orderId.split("-")[0] === req.user.username
        })
        // console.log(orders)

        return res.json({ count: orders.length })
    } catch (err) {
        next(err)
    }
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

        if (req.user.role === ROLE.Supplier && (order.orderId.split("-")[0] === req.user.username)) {
            forbiddenError("you cannot see order in other user except yourself or your item order")
        }

        order.order_details = await Promise.all(order.order_details.map(async od => {
            let item = await verifyItemId(od.itemId)
            od.itemname = item.name
            od.priceEach = Number(od.priceEach)
            let itemReview = await verifyReviewId(od.orderId, od.itemId, od.itemStyle, od.itemSize)
            od.rating = itemReview ? (itemReview.PQrating + itemReview.SSrating + itemReview.DSrating) / 3 : 0
            od.subTotal = od.priceEach * od.qtyOrder
            od.image = await listFirstImage(findImagePath("products", od.itemId), "main.png")
            return od
        }))
        order.itemOwner = order.orderId.split("-")[0]
        order.total = order.order_details.reduce((pre, order) => pre + Number(order.subTotal), 0)

        return res.json(orderConverter(order))
    } catch (err) {
        next(err)
    }
})

// get order item by order id
router.get('/groups/:orderGroupId', JwtAuth, async (req, res, next) => {
    try {
        let orderGroup = await verifyOrderGroupId(req.params.orderGroupId)

        let result = []
        for (order of orderGroup) {
            // if they are user or garden designer role
            if (ROLE.Admin !== req.user.role && order.customerName !== req.user.username) {
                forbiddenError("you cannot see order in other user except yourself")
            }

            if (req.user.role === ROLE.Supplier && (order.orderId.split("-")[0] === req.user.username)) {
                forbiddenError("you cannot see order in other user except yourself or your item order")
            }

            order.order_details = await Promise.all(order.order_details.map(async od => {
                let item = await verifyItemId(od.itemId)
                od.itemname = item.name
                od.priceEach = Number(od.priceEach)
                od.subTotal = od.priceEach * od.qtyOrder
                return od
            }))
            order.itemOwner = order.orderId.split("-")[0]
            // order.subTotal = order.order_details.reduce((pre, order) => pre + Number(order.subTotal), 0)
            result.push(orderConverter(order))
        }

        return res.json({
            orderGroupId: req.params.orderGroupId, orders: result,
            total: result.reduce((pre, cur) => pre + cur.order_details.reduce((pre, order) => pre + Number(order.subTotal), 0), 0),
            totalQty: result.reduce((pre, cur) => pre + cur.order_details.reduce((pre1, cur1) => pre1 + cur1.qtyOrder, 0), 0)
        })
    } catch (err) {
        next(err)
    }
})

// router.post('/prompt_pay/:orderId', JwtAuth, async (req, res, next) => {
//     const { orderId } = req.params;

//     try {
//         // find order
//         const order = await verifyOrderId(orderId);

//         // check order
//         if (order.status !== ORDERSTATUS.PENDING) {
//             validatError("your order cannot pay when status change")
//         } else if (order.customerName !== req.user.username) {
//             forbiddenError("you can pay with your order only")
//         }

//         // use supplier account number
//         const payment = await verifyPayment(order.orderId.split("-")[0]);

//         // total amount in order
//         order.amount = order.order_details.reduce((pre, cur) => pre += cur.priceEach * cur.qtyOrder, 0)

//         // generate qr code payload
//         const payload = generatePayload(payment.bankAccount, { amount: order.amount });
//         const option = {
//             color: {
//                 dark: '#000',
//                 light: '#fff'
//             }
//         }

//         // generate qr code with data url 64 bits
//         QRCode.toDataURL(payload, option, (err, url) => {
//             if (err) {
//                 validatError("generate failure")
//             }
//             else {
//                 return res.status(200).json({
//                     QRUrl: url
//                 })
//             }
//         })
//     } catch (err) {
//         next(err)
//     }
// })

// place order item with cart
router.post('/', JwtAuth, async (req, res, next) => {
    try {
        let { orderBodyId, orderGroupBodyId, carts, addressId } = req.body

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
        if (req.user.username !== accountAddress.username) {
            forbiddenError("user cannot place order by other people except yourself")
        }

        // validate some cart in owner item
        for (const cart of mycart) {
            if (cart.sessionId.split("-")[0] === req.user.username) {
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

        let orderGroupId = orderGroupBodyId !== undefined ? validateIdForTesting(req.user.username, orderGroupBodyId) : generateOrderId(req.user.username)
        for (let selectOwner in selectedSession) {
            // add order by address and status etc.
            let orderId = orderBodyId !== undefined ? validateIdForTesting(selectedSession[selectOwner].sessionId.split("-")[0], orderBodyId) : generateOrderId(selectedSession[selectOwner].sessionId.split("-")[0])
            await prisma.orders.create({
                data: {
                    orderId: orderId,
                    orderGroupId: orderGroupId,
                    customerName: accountAddress.username,
                    address: addressFormat,
                    phone: accountAddress.phone,
                    status: ORDERSTATUS.REQUIRED
                }
            })

            // find selected cart
            let selectedCart = mycart.filter(cart => cart.sessionId === selectedSession[selectOwner].sessionId)
            // let orderDetails = {}
            let totalPrice = 0
            // console.log(selectedCart)
            for (let cart of selectedCart) {
                let itemDetail = await verifyId(cart.itemId, cart.itemSize, cart.itemStyle)
                if (itemDetail == null) notFoundError("size and style of item id " + id + " does not exist")
                // add order details
                await prisma.order_details.create({
                    data: {
                        orderId: orderId,
                        itemStyle: cart.itemStyle,
                        itemId: cart.itemId,
                        itemSize: cart.itemSize,
                        qtyOrder: cart.qty,
                        priceEach: itemDetail.price
                    }
                })
                // console.log(orderInput)
                // push orderInput
                // orderDetails.order_details = orderDetailConverter(orderInput)

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

                // // remove item stock per quantity
                // await prisma.item_details.update({
                //     where: {
                //         itemId_style_size: {
                //             style: cart.itemStyle,
                //             itemId: cart.itemId,
                //             size: cart.itemSize,
                //         }
                //     },
                //     data: {
                //         stock: {
                //             decrement: cart.qty
                //         }
                //     }
                // })

                totalPrice += itemDetail.price * cart.qty
            }
            // console.log(orderDetails)
            // orders[selectedSession[selectOwner].sessionId.split("-")[0]] = orderDetails

            // console.log(totalPrice)

            // // delete session cart
            // await prisma.session_cart.update({
            //     where: {
            //         sessionCartId: selectedSession[selectOwner].sessionId
            //     },
            //     data: {
            //         total: {
            //             decrement: totalPrice
            //         }
            //     }
            // })

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
            // await prisma.session_cart.deleteMany({
            //     where: {
            //         total: 0
            //     }
            // })
        }

        let orderGroup = await verifyOrderGroupId(orderGroupId)

        let result = []
        for (order of orderGroup) {
            order.order_details = await Promise.all(order.order_details.map(async od => {
                let item = await verifyItemId(od.itemId)
                od.itemname = item.name
                od.priceEach = Number(od.priceEach)
                od.subTotal = od.priceEach * od.qtyOrder
                return od
            }))
            order.itemOwner = order.orderId.split("-")[0]
            // order.total = order.order_details.reduce((pre, order) => pre + Number(order.subTotal), 0)
            result.push(orderConverter(order))
        }

        return res.status(201).json({ orderGroupId: orderGroupId, orders: result, total: result.reduce((pre, cur) => pre + cur.order_details.reduce((pre1, order) => pre1 + order.subTotal, 0) , 0) })
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
        let { orderBodyId, orderGroupBodyId, itemId, style, size, qty, addressId } = req.body

        // find address account
        let accountAddress = await verifyAddressId(validateStr("validate account address", addressId, 53))

        // find cart items
        let item = await verifyItemId(validateInt("item id", Number(itemId)))
        qty = qty ? validateInt("item quantity", qty, false, 1) : 1
        let selectedItem = await verifyId(item.itemId, validateStr("item size", size, 50), validateStr("item style", style, 20))
        if (selectedItem == null) notFoundError("size and style of item id " + item.itemId + " does not exist")

        // validate other address place order
        if (req.user.username !== accountAddress.username) {
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
        let orderId = orderBodyId !== undefined ? validateIdForTesting(item.itemOwner, orderBodyId) : generateOrderId(item.itemOwner)
        let orderGroupId = orderGroupBodyId !== undefined ? validateIdForTesting(req.user.username, orderGroupBodyId) : generateOrderId(req.user.username)
        // console.log(orderId)
        let orderInput = await prisma.orders.create({
            data: {
                orderId: orderId,
                orderGroupId: orderGroupId,
                customerName: accountAddress.username,
                address: addressFormat,
                phone: accountAddress.phone,
                status: ORDERSTATUS.REQUIRED
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

        // // remove item stock per quantity
        // await prisma.item_details.update({
        //     where: {
        //         itemId_style_size: {
        //             style: style,
        //             itemId: item.itemId,
        //             size: size
        //         }
        //     },
        //     data: {
        //         stock: {
        //             decrement: qty
        //         }
        //     }
        // })
        return res.status(201).json(orderConverter(orderInput))
        // return res.json({orderId: orderId})
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
            forbiddenError("you cannot edit order in other supplier orders except yourself orders")
        }

        let { orderStatus } = req.body

        orderStatus = validateRole("validate order status", orderStatus, ORDERSTATUS, false)

        // before transit
        if (orderStatus === ORDERSTATUS.INPROGRESS && order.status === ORDERSTATUS.PENDING) {
            updatedOrder = await prisma.orders.update({
                data: {
                    status: ORDERSTATUS.INPROGRESS,
                    shippedOrderDate: addHours(new Date(), 7)
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
            validatError("supplier must be preparing product for transit to user only")
        }
    } catch (err) {
        next(err)
    }
})

// changing order status
router.put('/check_order/:orderId', JwtAuth, async (req, res, next) => {
    try {
        let { orderStatus } = req.body

        orderStatus = validateRole("validate order status", orderStatus, ORDERSTATUS, false)

        let order = await verifyOrderId(req.params.orderId)

        let updatedOrder = {}

        // checkout order when send to customer
        if (order.customerName === req.user.username) {
            if (order.status === ORDERSTATUS.INPROGRESS && orderStatus === ORDERSTATUS.COMPLETED && order.shippedOrderDate) {
                updatedOrder = await prisma.orders.update({
                    data: {
                        status: ORDERSTATUS.COMPLETED,
                        receivedOrderDate: addHours(new Date(), 7)
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
                validatError("customer must be recieving product only")
            }
        } else {
            forbiddenError("you cannot edit other customer order except yourself")
        }
    } catch (err) {
        next(err)
    }
})

// changing order status
router.put('/paid_order/:orderGroupId', JwtAuth, async (req, res, next) => {
    try {
        let { orderStatus } = req.body

        orderStatus = validateRole("validate order status", orderStatus, ORDERSTATUS, false)

        let orderGroup = await verifyOrderGroupId(req.params.orderGroupId)

        let orderPayment = []
        for (let order of orderGroup) {
            let updatedOrder = {}

            // checkout order when send to customer
            if (order.customerName === req.user.username && orderStatus === ORDERSTATUS.REQUIRED && !order.paidOrderDate) {
                updatedOrder = await prisma.orders.update({
                    data: {
                        status: ORDERSTATUS.PENDING,
                        paidOrderDate: addHours(new Date(), 7)
                    },
                    where: {
                        orderId: order.orderId
                    },
                    include: {
                        order_details: true
                    }
                })

                for (od of order.order_details) {
                    // add to cart on item event behaviour
                    await prisma.item_events.create({
                        data: {
                            itemId: od.itemId,
                            userId: req.user.id,
                            itemEvent: ITEMEVENT.PAID
                        }
                    })

                    // remove item stock per quantity
                    await prisma.item_details.update({
                        where: {
                            itemId_style_size: {
                                style: od.itemStyle,
                                itemId: od.itemId,
                                size: od.itemSize
                            }
                        },
                        data: {
                            stock: {
                                decrement: od.qtyOrder
                            }
                        }
                    })
                }
                updatedOrder.orderGroupId = undefined
                updatedOrder.total = updatedOrder.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
            } // cancel order
            else if (order.customerName === req.user.username && orderStatus === ORDERSTATUS.CANCELED && !order.paidOrderDate) {
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
                updatedOrder.orderGroupId = undefined
                updatedOrder.total = updatedOrder.order_details.reduce((pre, order) => pre + order.priceEach * order.qtyOrder, 0)
            } else {
                validatError("customer cannot paid or canceled order when this order has already to paid or canceled or cannot did in other user")
            }
            orderPayment.push(orderConverter(updatedOrder))
        }
        return res.json({ orderGroupId: req.params.orderGroupId, orders: orderPayment })
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
    // if (items == null) notFoundError("size and style of item id " + id + " does not exist")
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
        select: orderDetailView
    })
    if (order == null) notFoundError("order id " + orderId + " does not exist")
    return order
}

const verifyOrderGroupId = async (groupId) => {
    let order = await prisma.orders.findMany({
        where: {
            AND: [
                { orderGroupId: groupId }
            ]
        },
        include: {
            order_details: true
        }
    })
    if (order.length === 0) notFoundError("order group id " + groupId + " does not exist")
    return order
}

const verifyReviewId = async (orderId, itemId, itemStyle, itemSize) => {
    let itemReview = await prisma.item_reviews.findFirst({
        where: {
            AND: [
                {orderId: orderId},
                {itemId: itemId},
                {style: itemStyle},
                {size: itemSize}
            ]
        }
    })
    return itemReview
}

const verifyPayment = async (username) => {
    let payment = await prisma.payments.findFirst({
        where: {
            AND: [
                { username: username },
                { isDefault: true }
            ]
        }
    })
    if (payment == null) notFoundError("please create your payment first before transaction")
    return payment
}

module.exports = router