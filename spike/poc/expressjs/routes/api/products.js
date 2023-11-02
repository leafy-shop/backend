const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateBoolean, validateDouble, validateEmail, validateStrArray } = require('../validation/body')
const { notFoundError, validatError } = require('./../model/error/error')
const { dateTimeZoneNow } = require('./../model/class/datetimeUtils')
const { JwtAuth } = require('./../../middleware/jwtAuth')

const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

// product demo
const product_db = [
    {
        "name": "small zee cactus",
        "description": "this is cactus create by zee",
        "itemOwner": "piraphat123@gmail.com",
        "type": "cactus",
        "tag": ["cactus is amazing", "flower cactus", "cactus", "", "cactus", "Cactus"],
        "size": ["XS", "S"],
        "style": "light green cactus",
        "price": 32,
    },
    {
        "name": "lilac flower in beautiful jar",
        "description": "this is lilac flower create by zee",
        "itemOwner": "piraphat123@gmail.com",
        "type": "flower",
        "tag": ["lilac is relax", "levender flower", "", null, " "],
        "size": ["S", "M", "l", "L"],
        "style": "light purple flower",
        "price": 149
    },
    {
        "name": "golden rose",
        "itemOwner": "piraphat123@gmail.com",
        "type": "flower",
        "tag": ["rose", "golden rose", "Rose", null, " "],
        "size": ["S", "M", "l", "XL"],
        "style": "golden",
        "price": 289
    }
]

const userView = {
    userId: true,
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
    // let sorting = req.query.sort == 'desc' ? 'desc' : 'asc'

    // query params
    let { page, limit,
        isFav, product, min_price, max_price, rating,
        type, tag } = req.query

    // count items
    let count_pd = await prisma.items.count()
    // console.log(count_pd)

    // console.log(!! req.query.isFav)
    // console.log(Boolean(req.query.isFav))

    // favFilter mode by show some user who are favorite
    let favFilter = isFav === undefined || isFav.toLocaleLowerCase() !== 'true' ? {} : { some: { userEmail: req.user.email } }

    // page number and page size
    let pageN = Number(page)
    let limitN = Number(limit)
    console.log(limit)

    // filter single and between value from name, price, rating and isFavPrd query
    // and return page that sorted by updateAt item
    let filter_pd = await prisma.items.findMany({
        skip: pageN > 0 ? (pageN - 1) * limitN : 0,
        take: limitN > 1 ? limitN : count_pd,
        include: {
            favprd: true,
        },
        where: {
            AND: [{
                name: {
                    contains: product
                },
                price: {
                    lte: max_price,
                    gte: min_price
                },
                totalRating: {
                    lte: rating,
                    gt: isNaN(rating - 1) ? undefined : rating - 1
                },
                favprd: favFilter
            }]
        },
        include: {
            favprd: false,
        },
        orderBy: { updatedAt: "asc" }
    })
    // filter includes array : complexity best case O(n), worst case O(n*(type+tag))
    filter_pd = filter_pd.filter(product =>
        type == undefined ? true : product.type.include(type.split(",")) &&
            tag == undefined ? true : product.tag.include(type.split(","))
    )
    // array converter
    filter_pd = filter_pd.map(product => {
        return productConverter(product)
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
        // return product by id
        return res.json(await verifyId(req.params.id))
    } catch (err) {
        next(err)
    }
})

router.post('/', JwtAuth, async (req, res, next) => {
    let { name, description, itemOwner, type, tag, size, style, price } = req.body
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

    // {
    //     "name": "small zee cactus",
    //     "description": "this is cactus create by zee",
    //     "itemOwner": "piraphat123@gmail.com",
    //     "type": "cactus",
    //     "tag": ["cactus is amazing","flower cactus","cactus","","cactus","Cactus"],
    //     "size": ["XS","S"],
    //     "style": "light green cactus",
    //     "price": 32,
    // }
    
    // created product from request body and validation
    try {
        let input = await prisma.items.create({
            data: {
                name: validateStr("item name", name, 100),
                description: validateStr("item description", description, 500, true),
                itemOwner: validateEmail("item owner", itemOwner, 100),
                type: validateStr("item type", type, 20),
                tag: validateStrArray("item tag", tag, 10, 20),
                size: validateStrArray("item size", size, 5, 4),
                style: validateStr("item type", type, 50),
                price: validateDouble("item price", price, true)
            }
        })
        return res.status(201).json(productConverter(input))
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
            let FavPrds = await prisma.favprd.create({
                data: {
                    userEmail: req.user.email,
                    productId: id
                }
            })
        } else {
            let unFavPrds = await prisma.favprd.delete({
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

    // body params mapping
    for (let i in req.body) {
        if (req.body[i] != undefined) {
            // map object from body when update in prisma model
            mapData[i] =
                i == "name" ? validateStr("item name", req.body[i], 100) :
                    i == "description" ? validateStr("item description", req.body[i], 500, true) :
                        i == "itemOwner" ? validateEmail("item owner", req.body[i], 100) :
                            i == "type" ? validateStr("item type", req.body[i], 20) :
                                i == "tag" ? validateStrArray("item tag", req.body[i], 10, 20) :
                                    i == "size" ? validateStrArray("item size", req.body[i], 5, 4) :
                                        i == "style" ? validateStr("item type", req.body[i], 50) :
                                            i == "price" ? validateDouble("item price", req.body[i], true) :
                                                i == "isOutOfStock" ? validateBoolean("item is out of stock", req.body[i]) : undefined // unused body request
        }
    }

    // update product
    try {
        let input = await prisma.items.update({
            where: {
                itemId: Number(req.params.id)
            },
            data: mapData
        })
        // return update product converter
        return res.json(productConverter(input))
    } catch (err) {
        // if product is not found
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "item id " + req.params.id + " does not exist"
            }
        }
        next(err)
    }
})

router.delete('/:id', JwtAuth, async (req, res, next) => {
    try {
        // find id to delete product
        let input = await prisma.items.delete({
            where: {
                itemId: validateInt("itemId", Number(req.params.id))
            }
        })
        return res.json("item id" + req.params.id + " has deleted")
    } catch (err) {
        // if product is not found
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "item id " + req.params.id + " does not exist"
            }
        }
        next(err)
    }
})

const verifyId = async (id) => {
    // find product by id
    let filter_pd = await prisma.items.findFirst({
        where: {
            itemId: Number(id)
        }
    })

    // check that product is found
    if (filter_pd == null) notFoundError("item id " + id + " does not exist")

    // return converter of product
    return productConverter(filter_pd)
}

const verifyUserEmail = async (userEmail) => {
    // find user by account email
    let filter_pd = await prisma.accounts.findFirst({
        select: userView,
        where: {
            email: userEmail
        }
    })

    if (filter_pd == null) notFoundError("item id " + id + " does not exist")
    return filter_pd
}

const findFavPdById = async (email, id) => {
    let fav_pd = await prisma.favprd.findFirst({
        where: {
            AND: [
                { itemId: Number(id) },
                { userEmail: email }
            ]
        }
    })
    return fav_pd
}

const productConverter = (product) => {
            // array converter
        product.tag = product.tag.split(",")
        product.size = product.size.split(",")
        product.images = product.images.split(",")

        product.createdAt = dateTimeZoneNow(product.createdAt);
        product.updatedAt = dateTimeZoneNow(product.updatedAt);
        return product
}

module.exports = router