const express = require('express');
const router = express.Router();

const { validateInt } = require('../validation/body')
const { notFoundError, forbiddenError, validatError } = require('./../model/error/error')
const { JwtAuth } = require('./../../middleware/jwtAuth')

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient()

router.get('/', JwtAuth, async (req, res, next) => {
    try {
        let mycart = await prisma.carts.findMany({
            where: {
                AND: [
                    { userEmail: req.user.email },
                    { qty: { not: 0 } },
                    { isPaid: false }
                ]
            },
            select: {
                cartId: true,
                qty: true,
                product: true
            }
        })
        mycart.forEach(p => {
            p.totalPrice = p.qty * p.product.price
        })
        return res.json({carts: mycart, total: mycart.reduce((pre, cur) => pre + cur.totalPrice, 0)})
    } catch (err) {
        next(err)
    }
})

router.get('/:id', JwtAuth, async (req, res, next) => {
    try {
        let mycart = await verifyId(req.params.id)
        if(mycart.userEmail !== req.user.email) forbiddenError("your cannot see other user carts except yourself")

        // console.log(mycart)
        mycart.totalPrice = mycart.qty * mycart.product.price

        return res.json(mycart)
    } catch (err) {
        next(err)
    }
})

router.put('/:id/increment', JwtAuth, async (req, res, next) => {
    try {
        let mycart = await verifyId(req.params.id)
        let qty = 1
        await verifyQty(mycart.product.productId, qty)
        if(mycart.userEmail !== req.user.email) forbiddenError("your cannot edit other user carts except yourself")

        let increment = await prisma.carts.update({
            where: { cartId: validateInt("cartId",Number(req.params.id)) },
            data: { qty: { increment: qty } },
            include: { product: true }
        })
        return res.json({message: `cart of ${increment.userEmail}, name: ${increment.product.product} has increment quantity`})
    } catch (err) {
        next(err)
    }
})

router.put('/:id/decrement', JwtAuth, async (req, res, next) => {
    try {
        let mycart = await verifyId(req.params.id)
        let qty = 1
        if(mycart.qty <= 1) validatError("your cart must have at least 1 quantity")
        await verifyQty(mycart.product.productId, -qty, next)
        if(mycart.userEmail !== req.user.email) forbiddenError("your cannot edit other user carts except yourself")

        let increment = await prisma.carts.update({
            where: { cartId: validateInt("cartId",Number(req.params.id)) },
            data: { qty: { decrement: qty } },
            include: { product: true }
        })
        return res.json({message: `cart of ${increment.userEmail}, name: ${increment.product.product} has decrement quantity`})
    } catch (err) {
        next(err)
    }
})

router.delete('/:id', async (req, res, next) => {
    try {
        let mycart = await verifyId(req.params.id)
        if(mycart.userEmail !== req.user.email) forbiddenError("your cannot edit other user carts except yourself")

        let increment = await prisma.carts.delete({
            where: { cartId: validateInt("cartId",Number(req.params.id)) }
        })
        return res.json({message: `cart id ${req.params.id} has been canceled`})
    } catch (err) {
        next(err)
    }
})

const verifyId = async (id) => {
    let mycart = await prisma.carts.findFirst({
        where: {
            AND: [{cartId: validateInt("cartId",Number(id))},{isPaid: false}]
        },
        select: {
            cartId: true,
            qty: true,
            product: true,
            userEmail: true
        }
    })
    if(mycart == null) notFoundError("cart id " + id + " does not exist")
    return mycart
}

const verifyQty = async (id, qty) => {
    let product = await prisma.products.findFirst({
        where: {
            productId: validateInt("productId",Number(id))
        }
    })
    let cart = await prisma.carts.aggregate({
        _sum: {
            qty: true
        },
        where: {
            AND: [
                {productId: product.productId},
                {isPaid: false}
            ]
        }
    }) 
    if(cart._sum.qty + qty > product.stock) validatError(`product ${product.productId}:${product.product} have quantity more than their stocks`)
}

module.exports = router