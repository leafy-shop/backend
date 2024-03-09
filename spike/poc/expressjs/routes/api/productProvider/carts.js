const express = require('express');
const router = express.Router();

const { validateInt, validateStr } = require('../../validation/body')
const { notFoundError, forbiddenError, validatError } = require('../../model/error/error')
const { JwtAuth } = require('../../../middleware/jwtAuth')

const { PrismaClient } = require('@prisma/client');
const { ITEMSIZE } = require('../../model/enum/item');
const { generateId, timeConverter } = require('../../model/class/utils/converterUtils');
const { ROLE } = require('../../model/enum/role');
const { listFirstImage, findImagePath } = require('../../model/class/utils/imageList');
const prisma = new PrismaClient()

router.get('/', JwtAuth, async (req, res, next) => {
    try {
        let my_session = await verifySession(req.user.username, true)

        let mycart = await prisma.carts.findMany({
            where: {
                sessionId: my_session.sessionCartId
            }
        })

        // Promise.all(
        //     mycart.map(async cart => {
        //         product = await verifyProductId(cart.itemId, cart.itemStyle, cart.itemSize)
        //         cart.priceEach = product.price
        //         cart.sessionId = undefined
        //         return cart
        //     })
        // ).then(mycart => {
        //     my_session.cart = mycart
        //     return res.json(timeConverter(my_session))
        // }).catch(err => {
        //     next(err)
        // })

        // create cart and loop by their image, price and group
        let groupCart = new Set()
        for (let cart of mycart) {
            let product = await verifyProductId(cart.itemId, cart.itemStyle, cart.itemSize);
            cart.image = await listFirstImage(findImagePath("products", cart.itemId), "main.png")
            cart.priceEach = product.price;
            cart.sessionId = undefined;
            cart = timeConverter(cart)
            groupCart.add(cart.itemId)
        }

        // loop group of cart and separate item owner
        let resultCart = []
        for (cartId of groupCart) {
            let filterGroupCart = mycart.filter(cart => cartId == cart.itemId)
            console.log(filterGroupCart)
            let item = await prisma.items.findFirst({
                where: {
                    itemId: cartId
                }
            })
            let cartObj = {}
            cartObj[item.itemOwner] = filterGroupCart
            resultCart.push(cartObj)
        }

        my_session.total = parseFloat(my_session.total).toFixed(2)
        my_session.shipping = 0;
        my_session.tax = 0;
        my_session.cart = resultCart;
        res.json(timeConverter(my_session));
    } catch (err) {
        next(err)
    }
})

// router.get('/:id', JwtAuth, async (req, res, next) => {
//     try {
//         let mycart = await verifyId(req.params.id)
//         if (mycart.username !== req.user.name) forbiddenError("your cannot see other user carts except yourself")

//         // console.log(mycart)
//         mycart.totalPrice = mycart.qty * mycart.product.price

//         return res.json(mycart)
//     } catch (err) {
//         next(err)
//     }
// })

// create carts from item details
router.post('/products', JwtAuth, async (req, res, next) => {
    let { itemId, style, size } = req.body
    itemId = Number(itemId)
    style = style ? style : ITEMSIZE.No
    size = size ? size : ITEMSIZE.No

    try {
        let choosePd = await verifyProductId(
            validateInt("product id", itemId),
            validateStr("product style", style, 50),
            validateStr("product size", size, 50)
        )

        // create cart item
        let cart = {}
        let sessionCart = await verifySession(req.user.username)
        let cartItem = await verifyId(itemId, size, style)

        // check quantity
        cartItem = cartItem ? cartItem : { qty: 0 }
        // console.log(choosePd.stock)
        // console.log(cartItem.qty)
        if (choosePd.stock <= cartItem.qty) validatError(`product:${itemId} at style:${style} and size:${size} have out stocks`)

        if (cartItem.cartId && sessionCart) {
            // update quantity item
            cart = await prisma.carts.update({
                data: {
                    qty: { increment: 1 }
                },
                where: {
                    cartId: cartItem.cartId,
                }
            })
            // update total price
            sessionCart = await prisma.session_cart.update({
                data: {
                    total: { increment: choosePd.price }
                },
                where: {
                    sessionCartId: cart.sessionId
                }
            })
        } else if (!cartItem.cartId && sessionCart) {
            let cartId = generateId(16)
            cart = await prisma.carts.create({
                data: {
                    cartId: cartId,
                    sessionId: sessionCart.sessionCartId,
                    itemId: choosePd.itemId,
                    itemStyle: choosePd.style,
                    itemSize: choosePd.size,
                    qty: 1
                }
            })

            // update create session cart
            sessionCart = await prisma.session_cart.update({
                data: {
                    total: { increment: choosePd.price }
                },
                where: {
                    sessionCartId: sessionCart.sessionCartId
                }
            })
        } else {
            let sessionId = generateId(16);
            sessionCart = await prisma.session_cart.create({
                data: {
                    sessionCartId: sessionId,
                    username: req.user.username,
                    total: choosePd.price
                }
            })

            let cartId = generateId(16)
            cart = await prisma.carts.create({
                data: {
                    cartId: cartId,
                    sessionId: sessionCart.sessionCartId,
                    itemId: choosePd.itemId,
                    itemStyle: choosePd.style,
                    itemSize: choosePd.size,
                    qty: 1
                }
            })
        }

        return res.status(201).json({ msg: `your product ${choosePd.itemId} price ${sessionCart.total} baht that add in your cart with quantity ${cart.qty}` })
    } catch (err) {
        next(err)
    }
})

// increment quantity
router.put('/:id', JwtAuth, async (req, res, next) => {
    try {
        let my_session = await verifySession(req.user.username, true)
        let mycart = await verifyIdByCart(req.params.id)
        let item_detail = await verifyProductId(mycart.itemId, mycart.itemStyle, mycart.itemSize)
        let qty = validateInt("validate quantity", req.body.qty, false, 0, item_detail.stock)
        if (my_session === null) forbiddenError("your must create new session")

        if (qty) {
            await prisma.carts.update({
                where: { cartId: req.params.id },
                data: { qty: qty }
            })

            let myallcart = await prisma.carts.findMany({
                where: {
                    sessionId: my_session.sessionCartId
                }
            })

            let promises = myallcart.map(async (cur) => {
                let product = await verifyProductId(cur.itemId, cur.itemStyle, cur.itemSize);
                return cur.qty * product.price;
            });

            let totalPrices = await Promise.all(promises);

            let sumTotal = totalPrices.reduce((acc, curr) => acc + curr, 0);

            await prisma.session_cart.update({
                data: {
                    total: sumTotal
                },
                where: {
                    sessionCartId: my_session.sessionCartId
                }
            });
            return res.json({ message: `cart id ${mycart.cartId} of ${req.user.username} has updated` })

        } else {
            // delete cart
            await prisma.carts.delete({
                where: { cartId: mycart.cartId }
            })

            // update new price
            await prisma.session_cart.update({
                data: {
                    total: {
                        decrement: mycart.qty * item_detail.price
                    }
                },
                where: {
                    sessionCartId: mycart.sessionId
                }
            })
            return res.json({ message: `cart id ${req.params.id} has been canceled` })
        }
    } catch (err) {
        next(err)
    }
})

// delete cart
router.delete('/:id', JwtAuth, async (req, res, next) => {
    try {
        await verifySession(req.user.username, true)
        let mycart = await verifyIdByCart(req.params.id)
        let item_detail = await verifyProductId(mycart.itemId, mycart.itemStyle, mycart.itemSize)

        // delete cart
        await prisma.carts.delete({
            where: { cartId: mycart.cartId }
        })

        // update new price
        await prisma.session_cart.update({
            data: {
                total: {
                    decrement: mycart.qty * item_detail.price
                }
            },
            where: {
                sessionCartId: mycart.sessionId
            }
        })

        return res.json({ message: `cart id ${req.params.id} has been canceled` })
    } catch (err) {
        next(err)
    }
})

// delete session
router.delete('/:id/session', JwtAuth, async (req, res, next) => {
    try {
        let mysession = await verifySessionById(req.params.id, true)
        if (req.user.role !== ROLE.admin && mysession.username !== req.user.username) {
            forbiddenError("your cannot delete other user carts session except yourself")
        }

        await prisma.session_cart.delete({
            where: { sessionCartId: mysession.sessionCartId }
        })
        return res.json({ message: `cart session id ${req.params.id} has been delete` })
    } catch (err) {
        next(err)
    }
})

//----------------------------------------- method zone ----------------------------------------------------

const verifyProductId = async (id, style, size) => {
    let mycart = await prisma.item_details.findFirst({
        where: {
            AND: [
                { itemId: Number(id) },
                { style: style },
                { size: size }
            ]
        }
    })
    if (mycart == null) notFoundError("cart id " + id + " does not exist")
    return mycart
}

const verifyId = async (id, size, style) => {
    let mycart = await prisma.carts.findFirst({
        where: {
            AND: [
                { itemId: id },
                { itemSize: size },
                { itemStyle: style }
            ]
        }
    })
    // if (mycart == null) notFoundError("cart id " + id + " does not exist")
    return mycart
}

const verifyIdByCart = async (id) => {
    let mycart = await prisma.carts.findFirst({
        where: {
            cartId: id
        }
    })
    if (mycart == null) notFoundError("cart id " + id + " does not exist")
    return mycart
}

const verifySession = async (name, isError = false) => {
    let mycart = await prisma.session_cart.findFirst({
        where: {
            username: name
        }
    })
    if (mycart == null && isError) notFoundError("session cart with name " + name + " does not exist")
    return mycart
}

const verifySessionById = async (id) => {
    let mycart = await prisma.session_cart.findFirst({
        where: {
            sessionCartId: id
        }
    })
    if (mycart == null) notFoundError("session cart id " + id + " does not exist")
    return mycart
}

// const verifyQty = async (id, qty) => {
//     let product = await prisma.products.findFirst({
//         where: {
//             productId: validateInt("productId", Number(id))
//         }
//     })
//     let cart = await prisma.carts.aggregate({
//         _sum: {
//             qty: true
//         },
//         where: {
//             AND: [
//                 { productId: product.productId },
//                 { isPaid: false }
//             ]
//         }
//     })
//     if (cart._sum.qty + qty > product.stock) validatError(`product ${product.productId}:${product.product} have quantity more than their stocks`)
// }

module.exports = router