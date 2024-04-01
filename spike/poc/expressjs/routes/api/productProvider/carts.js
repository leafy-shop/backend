const express = require('express');
const router = express.Router();

const { validateInt, validateStr, validateIdForTesting } = require('../../validation/body')
const { notFoundError, forbiddenError, validatError } = require('../../model/error/error')
const { JwtAuth, UnstrictJwtAuth } = require('../../../middleware/jwtAuth')

const { PrismaClient, Prisma } = require('@prisma/client');
const { ITEMSIZE, ITEMEVENT } = require('../../model/enum/item');
const { generateIdByMapping, timeConverter } = require('../../model/class/utils/converterUtils');
const { ROLE } = require('../../model/enum/role');
const { listFirstImage, findImagePath } = require('../../model/class/utils/imageList');
const prisma = new PrismaClient()

router.get('/', JwtAuth, async (req, res, next) => {
    try {
        // find my session
        let mySession = await verifySessionMany(req.user.username)

        // list all group item id
        let myOwnerSession = new Set(mySession.map(session => session.sessionCartId.split("-")[0]))
        console.log(myOwnerSession)

        let resultSession = { carts: [] }
        let myOwnerCart = []
        for (let session in mySession) {
            // list all cart by onwer session
            let carts = await prisma.carts.findMany({
                where: {
                    sessionId: mySession[session].sessionCartId
                }
            })

            carts.forEach(cart => {
                cart.itemOwner = cart.sessionId.split("-")[0]
                myOwnerCart.push(cart)
            })
        }

        // console.log(myOwnerCart)

        // create cart and loop by their image, price
        for (let sessionGroup of myOwnerSession) {
            let cartGroup = {}
            // find all cart in item group
            let cartFilterOwner = myOwnerCart.filter(ownerCart => {
                // console.log(ownerCart.itemOwner)
                // console.log(sessionGroup)
                return ownerCart.itemOwner === sessionGroup
            })
            console.log(cartFilterOwner.length)

            // store all cart in item group like their image, price
            cartFilterOwner = await Promise.all(cartFilterOwner.map(async cart => {
                let product = await verifyProductId(cart.itemId, cart.itemStyle, cart.itemSize);
                // console.log(filterGroupCart)
                cart.image = await listFirstImage(findImagePath("products", cart.itemId), "main.png")
                cart.priceEach = parseFloat(product.price).toFixed(2);
                cart.sessionId = undefined;
                let itemname = await verifyItemOwner(cart.itemId)
                cart.itemName = itemname.name
                cart.stock = product.stock
                return timeConverter(cart)
            }))

            // console.log(resultCart)
            cartGroup.cartOwner = cartFilterOwner
            cartGroup.itemOwner = sessionGroup
            resultSession.carts.push(cartGroup);
        }

        // declare value for return on my cart session
        resultSession.total = parseFloat(mySession.reduce((pre, cur) => pre + Number(cur.total), 0)).toFixed(2)
        resultSession.shipping = parseFloat(0).toFixed(2);
        resultSession.tax = parseFloat(0).toFixed(2);
        return res.json(timeConverter(resultSession));
    } catch (err) {
        next(err)
    }
})

router.get('/count', UnstrictJwtAuth, async (req, res, next) => {
    try {
        let result = { count: 0 }
        if (req.user !== undefined) {
            // find my session
            let mySession = await verifySessionMany(req.user.username)

            for (let session in mySession) {
                // list all group item id
                let myQty = await prisma.carts.aggregate({
                    _sum: {
                        qty: true
                    },
                    where: {
                        sessionId: mySession[session].sessionCartId
                    }
                })
                result.count += myQty._sum.qty
            }
        }


        // declare value for return on my cart session
        // resultSession.total = parseFloat(mySession.reduce((pre, cur) => pre + Number(cur.total), 0)).toFixed(2)
        // resultSession.shipping = parseFloat(0).toFixed(2);
        // resultSession.tax = parseFloat(0).toFixed(2);
        return res.json(result);
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
    let { sessionBodyId, cartBodyId, itemId, style, size, qty } = req.body
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

        qty = qty ? validateInt("product qty", qty, false, 0) : 1

        // create cart item
        let cart = {}
        let sessionCart = await verifySession(req.user.username)
        let cartItem = await verifyId(itemId, size, style)

        // find item on item
        // let itemInCart = await verifyItemId()
        let itemOwner = await verifyItemOwner(choosePd.itemId)

        console.log(itemOwner)

        // console.log(sessionCart)
        // console.log(itemOwner.itemOwner)

        // check quantity
        cartItem = cartItem ? cartItem : { qty: 0 }
        if (choosePd.stock < cartItem.qty + qty) validatError(`product:${itemId} at style:${style} and size:${size} have out stocks`)

        if (itemOwner.itemOwner === req.user.username) forbiddenError(`product:${itemId} at style:${style} and size:${size} cannot added from your product`)

        // if user already has cart item input and owner session cart
        if (cartItem && cartItem.cartId === cartBodyId && req.user.username === cartItem.cartId.split("-")[0] && sessionCart) {
            // update quantity item
            cart = await prisma.carts.update({
                data: {
                    qty: { increment: qty }
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
        } else if (sessionCart && itemOwner.itemOwner === sessionCart.sessionCartId.split("-")[0] && !cartItem.cartId) {
            // create cart item
            let cartId = cartBodyId !== undefined ? validateIdForTesting(cartBodyId.split("-")[0], cartBodyId.split("-")[1]) : generateIdByMapping(16, req.user.username)
            // console.log(cartId, cartId.length)
            cart = await prisma.carts.create({
                data: {
                    cartId: cartId,
                    sessionId: sessionCart.sessionCartId,
                    itemId: choosePd.itemId,
                    itemStyle: choosePd.style,
                    itemSize: choosePd.size,
                    qty: qty
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
            let sessionId = generateIdByMapping(16, itemOwner.itemOwner);
            sessionCart = await prisma.session_cart.create({
                data: {
                    sessionCartId: sessionId,
                    username: req.user.username,
                    total: choosePd.price
                }
            })
            // create cart item
            let cartId = cartBodyId !== undefined ? validateIdForTesting(cartBodyId.split("-")[0], cartBodyId.split("-")[1]) : generateIdByMapping(16, req.user.username)
            cart = await prisma.carts.create({
                data: {
                    cartId: cartId,
                    sessionId: sessionCart.sessionCartId,
                    itemId: choosePd.itemId,
                    itemStyle: choosePd.style,
                    itemSize: choosePd.size,
                    qty: qty
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

        }

        return res.status(201).json({ msg: `your product ${choosePd.itemId} price ${sessionCart.total} baht that add in your cart with quantity ${cart.qty}` })
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.meta.target === 'PRIMARY') {
                err.message = "cart of user is duplicated"
            }
        }
        next(err)
    }
})

// increment quantity
router.put('/:id', JwtAuth, async (req, res, next) => {
    try {
        // find session by username
        let mySession = await verifySession(req.user.username, true)

        // authorization validation check
        if (req.user.role !== ROLE.admin && mySession.username !== req.user.username) {
            forbiddenError("your cannot delete other user carts session except yourself")
        }

        // find cart by cart id
        let mycart = await verifyIdByCart(req.params.id)

        // find item detail by item id, style and size
        let itemDetail = await verifyProductId(mycart.itemId, mycart.itemStyle, mycart.itemSize)

        // validate quantities in cart
        let qty = validateInt("validate quantity", req.body.qty, false, 0, itemDetail.stock)

        // validate session owner
        if (mySession === null) forbiddenError("your must create new session")

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
                    sessionId: mySession.sessionCartId
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
                    sessionCartId: mySession.sessionCartId
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
                        decrement: mycart.qty * itemDetail.price
                    }
                },
                where: {
                    sessionCartId: mycart.sessionId
                }
            })

            let carts = await prisma.carts.findMany({
                where: {
                    sessionId: mycart.sessionId
                }
            })
            if (carts.length == 0) {
                await prisma.session_cart.delete({
                    where: { sessionCartId: mycart.sessionId }
                })
            }
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
        let mySession = await verifySession(req.user.username, true)

        // authorization validation check
        if (req.user.role !== ROLE.admin && mySession.username !== req.user.username) {
            forbiddenError("your cannot delete other user carts except yourself")
        }

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

        let carts = await prisma.carts.findMany({
            where: {
                sessionId: mycart.sessionId
            }
        })
        if (carts.length == 0) {
            await prisma.session_cart.delete({
                where: { sessionCartId: mycart.sessionId }
            })
        }

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
    if (mycart == null) notFoundError("item detail id " + id + " with sku style " + style + " and have size " + size + " does not exist")
    return mycart
}

const verifyItemOwner = async (id) => {
    let itemId = await prisma.items.findFirst({
        where: {
            itemId: id
        }
    })
    // if (mycart == null) notFoundError("cart id " + id + " does not exist")
    return itemId
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

const verifySessionMany = async (name) => {
    let mysession = await prisma.session_cart.findMany({
        where: {
            username: name
        }
    })
    // if (mysession.length === 0) notFoundError("session cart with name " + name + " does not exist")
    return mysession
}

const verifySession = async (name, isError = false) => {
    let mysession = await prisma.session_cart.findFirst({
        where: {
            username: name
        }
    })
    if (mysession == null && isError) notFoundError("session cart with name " + name + " does not exist")
    return mysession
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