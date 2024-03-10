const express = require('express');
const router = express.Router();

const { validateInt, validateStr } = require('../../validation/body')
const { notFoundError, forbiddenError, validatError } = require('../../model/error/error')
const { JwtAuth } = require('../../../middleware/jwtAuth')

const { PrismaClient } = require('@prisma/client');
const { ITEMSIZE, ITEMEVENT } = require('../../model/enum/item');
const { generateId, timeConverter } = require('../../model/class/utils/converterUtils');
const { ROLE } = require('../../model/enum/role');
const { listFirstImage, findImagePath } = require('../../model/class/utils/imageList');
const prisma = new PrismaClient()

router.get('/', JwtAuth, async (req, res, next) => {
    try {
        // find my session
        let my_session = await verifySession(req.user.username, true)

        // list all group item id
        let mycart = await prisma.carts.groupBy({
            by: ["itemId"],
            where: {
                sessionId: my_session.sessionCartId
            }
        })

        // create cart and loop by their image, price
        let resultCart = []
        for (let cartGroup of mycart) {
            // find all cart in item group
            let carts = await prisma.carts.findMany({
                where: {
                    itemId: cartGroup.itemId
                }
            })

            // store all cart in item group like their image, price
            let ownerCart = []
            for (let cart of carts) {
                let product = await verifyProductId(cart.itemId, cart.itemStyle, cart.itemSize);
                // console.log(filterGroupCart)
                cart.image = await listFirstImage(findImagePath("products", cart.itemId), "main.png")
                cart.priceEach = parseFloat(product.price).toFixed(2);
                cart.sessionId = undefined;
                cart = timeConverter(cart)
                ownerCart.push(cart)
            }

            // list item owner and mapping before add on result cart
            let item = await prisma.items.findFirst({
                where: {
                    itemId: cartGroup.itemId
                }
            })
            cartGroup[item.itemOwner] = ownerCart
            cartGroup.itemId = undefined
            resultCart.push(cartGroup)
        }

        // declare value for return on my cart session
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
        // select item detail by item id, style and size
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
        if (choosePd.stock <= cartItem.qty) validatError(`product:${itemId} at style:${style} and size:${size} have out stocks`)

        // if user already has cart item input and owner session cart
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

            // add to cart on item event behaviour
            await prisma.item_events.create({
                data: {
                    itemId: cartItem.itemId,
                    userId: req.user.id,
                    itemEvent: ITEMEVENT.ATC
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
            // if user already has owner session cart but in owner cart item input is empty
        } else if (!cartItem.cartId && sessionCart) {
            // create cart item
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

            // add to cart on item event behaviour
            await prisma.item_events.create({
                data: {
                    itemId: cart.itemId,
                    userId: req.user.id,
                    itemEvent: ITEMEVENT.ATC
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
            // if user has not owner session cart
        } else {
            // create session cart
            let sessionId = generateId(16);
            sessionCart = await prisma.session_cart.create({
                data: {
                    sessionCartId: sessionId,
                    username: req.user.username,
                    total: choosePd.price
                }
            })

            // add to cart on item event behaviour
            await prisma.item_events.create({
                data: {
                    itemId: cartItem.itemId,
                    userId: req.user.id,
                    itemEvent: ITEMEVENT.ATC
                }
            })
            
            // create cart item
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
        // find session by username
        let my_session = await verifySession(req.user.username, true)

        // find cart by cart id
        let mycart = await verifyIdByCart(req.params.id)

        // find item detail by item id, style and size
        let item_detail = await verifyProductId(mycart.itemId, mycart.itemStyle, mycart.itemSize)

        // validate quantities in cart
        let qty = validateInt("validate quantity", req.body.qty, false, 0, item_detail.stock)

        // validate session owner
        if (my_session === null) forbiddenError("your must create new session")

        // update cart quantity check
        if (qty) {
            // update quantity
            await prisma.carts.update({
                where: { cartId: req.params.id },
                data: { qty: qty }
            })

            // find session by session id
            let myallcart = await prisma.carts.findMany({
                where: {
                    sessionId: my_session.sessionCartId
                }
            })

            // map product all price in each cart on promise
            let promises = myallcart.map(async (cur) => {
                let product = await verifyProductId(cur.itemId, cur.itemStyle, cur.itemSize);
                return cur.qty * product.price;
            });

            let totalPrices = await Promise.all(promises);

            // return sum total of product price
            let sumTotal = totalPrices.reduce((acc, curr) => acc + curr, 0);

            // update new price
            await prisma.session_cart.update({
                data: {
                    total: sumTotal
                },
                where: {
                    sessionCartId: my_session.sessionCartId
                }
            });
            return res.json({ message: `cart id ${mycart.cartId} of ${req.user.username} has updated` })

            // delete cart by quantity check
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
        // find session by username
        await verifySession(req.user.username, true)

        // find cart by cart id
        let mycart = await verifyIdByCart(req.params.id)

        // find item detail by item id, style and size
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

// delete session by id
router.delete('/:id/session', JwtAuth, async (req, res, next) => {
    try {
        // find all session
        let mysession = await verifySessionById(req.params.id, true)

        // authorization validation check
        if (req.user.role !== ROLE.admin && mysession.username !== req.user.username) {
            forbiddenError("your cannot delete other user carts session except yourself")
        }

        // delete session
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