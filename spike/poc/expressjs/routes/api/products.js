const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateBoolean, validateDouble } = require('../validation/body')
const { notFoundError, validatError } = require('./../model/error/error')
const { JwtAuth } = require('./../../middleware/jwtAuth')

const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

// const product_db = [
//     {
//         "id": 2,
//         "product": "small graden",
//         "price": 1000
//     },
//     {
//         "id": 4,
//         "product": "normal graden",
//         "price": 3000
//     },
//     {
//         "id": 5,
//         "product": "large graden",
//         "price": 5000
//     }
// ]
const userView = {
    name: true,
    email: true,
    role: true,
    FavPrd: {
        select: {
            product: true
        }
    },
    createdAt: true,
    updatedAt: true
}

router.get('/', JwtAuth, async (req, res, next) => {
    // let filter_pd = product_db.filter( p => {
    //     console.log(p)
    //     return (req.query.product == undefined ? true : p.product.includes(req.query.product)) &&
    //     (req.query.price == undefined ? true : req.query.price == p.price)
    // })
    // filter_pd = filter_pd.sort( (a,b) => b[req.query.sort] - a[req.query.sort] )
    let sorting = req.query.sort == 'desc' ? 'desc' : 'asc'

    let count_pd = await prisma.products.count()

    // console.log(!! req.query.isFav)
    // console.log(Boolean(req.query.isFav))

    let favFilter = req.query.isFav.toLocaleLowerCase() === 'true'? {some: {userEmail : req.user.email}} : {}
    let page = Number(req.query.page)
    let limit = Number(req.query.limit)

    let filter_pd = await prisma.products.findMany({
        skip: page > 0 ? (page - 1) * limit : 0,
        take: limit > 1 ? limit : count_pd,
        include: {
            FavPrd: true,
        },
        where: {
            AND: [{
                product: {
                    contains: req.query.product
                },
                price: req.query.price,
                FavPrd: favFilter
            }]
        },
        include: {
            FavPrd: false,
        },
        orderBy: { stock: sorting }
    })
    return res.json(filter_pd)
})

router.get('/:id', JwtAuth, async (req, res, next) => {
    // let filter_pd = product_db.filter( p => {
    //     console.log(p)
    //     return (req.query.product == undefined ? true : p.product.includes(req.query.product)) &&
    //     (req.query.price == undefined ? true : req.query.price == p.price)
    // })
    // filter_pd = filter_pd.sort( (a,b) => b[req.query.sort] - a[req.query.sort] )
    try {
        return res.json(await verifyId(req.params.id))
    } catch (err) {
        next(err)
    }
})

router.post('/', JwtAuth, async (req, res, next) => {
    let { product, price, stock } = req.body
    // let numberids = []
    // product_db.sort((a, b) => a.id - b.id).forEach(item => {
    //     numberids.push(item.id)
    // })
    // console.log(numberids)
    // let current = 1
    // numberids.forEach(num => {
    //     if (current == num) {
    //         current++
    //     }
    // })
    try {
        let input = await prisma.products.create({
            data: {
                product: validateStr("product", product, 100),
                price: validateDouble("price", price, true),
                stock: validateInt("stock", stock, true)
            }
        })
        return res.status(201).json(input)
    } catch (err) {
        next(err)
    }
})

router.post('/addtocart', JwtAuth, async (req, res, next) => {
    let { productId, qty } = req.body

    try {
        let choosePd = await verifyId(productId)

        let cart = await prisma.carts.aggregate({
            _sum: {
                qty: true
            },
            where: {
                AND: [
                    { productId: choosePd.productId },
                    { isPaid: false }
                ]
            }
        })

        if (cart._sum.qty + validateInt("quantity", qty, true) > choosePd.stock) validatError(`product ${productId}:${choosePd.product} have quantity more than their stocks`)

        let input = await prisma.carts.create({
            data: {
                userEmail: req.user.email,
                productId: productId,
                qty: qty
            }
        })
        return res.status(201).json({ msg: `your product ${choosePd.productId} ${choosePd.product} - ${choosePd.price} baht that add in your cart` })
    } catch (err) {
        next(err)
    }
})

router.put('/isFav/:id', JwtAuth, async (req, res, next) => {
    try {
        let id = Number(req.params.id)
        if (await findFavPdById(req.user.email, id) == null) {
            let FavPrds = await prisma.FavPrd.create({
                data: {
                    userEmail: req.user.email,
                    productId: id
                }
            })
        } else {
            let unFavPrds = await prisma.FavPrd.delete({
                where: {
                    productId_userEmail: {
                        productId: id,
                        userEmail: req.user.email
                    }
                }
            })
        }
        return res.json(await verifyUserEmail(req.user.email))
    } catch (err) {
        console.log(err)
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2002') {
                err.message = "product of user is duplicated"
            }
        }
        next(err)
    }
})

router.patch('/:id', JwtAuth, async (req, res, next) => {
    let mapData = {}

    for (let i in req.body) {
        if (req.body[i] != undefined) {
            mapData[i] = typeof req.body[i] == "string" ? validateStr(i, req.body[i], 100) :
                typeof req.body[i] == "number" ? validateInt(i, req.body[i]) : validateBoolean(i, req.body[i])
        }
    }

    try {
        let input = await prisma.products.update({
            where: {
                productId: Number(req.params.id)
            },
            data: mapData
        })
        return res.json(input)
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "product id " + req.params.id + " does not exist"
            }
        }
        next(err)
    }
})

router.delete('/:id', JwtAuth, async (req, res, next) => {
    try {
        let input = await prisma.products.delete({
            where: {
                productId: validateInt("productId", Number(req.params.id))
            }
        })
        return res.json("product id" + req.params.id + " has deleted")
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "product id " + req.params.id + " does not exist"
            }
        }
        next(err)
    }
})

const verifyId = async (id) => {
    let filter_pd = await prisma.products.findFirst({
        where: {
            productId: validateInt("productId", id)
        }
    })
    if (filter_pd == null) notFoundError("product id " + id + " does not exist")
    return filter_pd
}

const verifyUserEmail = async (userEmail) => {
    let filter_pd = await prisma.users.findFirst({
        select: userView,
        where: {
            email: userEmail
        }
    })
    if (filter_pd == null) notFoundError("product id " + id + " does not exist")
    return filter_pd
}

const findFavPdById = async (email,id) => {
    let fav_pd = await prisma.FavPrd.findFirst({
        where: {
            AND: [
                {productId: validateInt("productId", id)},
                {userEmail: email}
            ]
        }
    })
    return fav_pd
}


module.exports = router