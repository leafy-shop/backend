const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateBoolean, validateDouble, validateEmail, validateStrArray } = require('../validation/body')
const { notFoundError, validatError } = require('./../model/error/error')
const { dateTimeZoneNow } = require('../model/class/utils/datetimeUtils')
const { userViewFav, prodList } = require('./../model/class/model')
const { JwtAuth } = require('./../../middleware/jwtAuth')

const { PrismaClient, Prisma } = require('@prisma/client');
const { modelMapper } = require('../model/class/utils/modelMapping');
const { mode } = require('../../config/minio_config');
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
    },
    {
        "name": "big zee cactus",
        "description": "this is very BIG cactus create by zee",
        "itemOwner": "piraphat123@gmail.com",
        "type": "cactus",
        "tag": ["cactus", "very cute", "very fat and high"],
        "size": ["l", "xL"],
        "style": "golden",
        "price": 570
    },
    {
        "name": "zee shovel",
        "itemOwner": "piraphat123@gmail.com",
        "type": "tool",
        "tag": ["shovel", "tool"],
        "style": "shapen shovel",
        "price": 139
    }
]

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
    // console.log(limit)

    // filter single and between value from name, price, rating and isFavPrd query
    // and return page that sorted by updateAt item
    try {
        let filter_pd = await prisma.items.findMany({
            include: {
                favprd: true
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
                    favprd: favFilter,
                }]
            },
            include: {
                favprd: false,
            },
            orderBy: { updatedAt: "desc" }
        })

        // filter includes array : complexity best case O(n), worst case O(n*(type+tag))
        filter_pd = filter_pd.filter(product => 
            type == undefined ? true : type.split(",").includes(product.type)
            // console.log(type.split(","))
            // console.log(product.type)
            // console.log(type.split(",").includes(product.type))

            // https://stackoverflow.com/questions/16312528/check-if-an-array-contains-any-element-of-another-array-in-javascript
            && tag == undefined ? true : tag.split(",").some(r => product.tag.split(",").includes(r))
            // console.log(tag.split(","))
            // console.log(product.tag.split(","))
            // console.log(tag.split(",").some(r => product.tag.split(",").includes(r)))
        )

        // return to page with page number and page size
        let VarPage = pageN > 0 ? (pageN - 1) * limitN : 0
        let VarLimit = limitN >= 1 ? limitN : count_pd
        filter_pd = filter_pd.slice(VarPage,VarPage+VarLimit)

        // array converter
        filter_pd = filter_pd.map(product => {
            return productConverter(product, prodList)
        })
        return res.json(filter_pd)
    } catch (err) {
        // if favorite product is not found in this user
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2022') {
                err.message = "this user has not favorite product"
                err.status = 404
            }
        }
        next(err)
    }
})

router.get('/:id', JwtAuth, async (req, res, next) => {
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
        // if user hasn't favorite in this product id then add favorite product item
        if (await findFavPdById(req.user.email, id) == null) {
            await prisma.favprd.create({
                data: {
                    userEmail: req.user.email,
                    itemId: id
                }
            })
        // if user has favorite in this product id then clear favorite product item
        } else {
            await prisma.favprd.delete({
                where: {
                    itemId_userEmail: {
                        itemId: id,
                        userEmail: req.user.email
                    }
                }
            })
        }
        return res.json(await verifyUserEmail(req.user.email))
    } catch (err) {
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
        return res.json("item id " + req.params.id + " has been deleted")
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
        select: userViewFav(),
        where: {
            email: userEmail
        }
    })

    if (filter_pd == null) notFoundError("user email " + email + " does not exist")
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

const productConverter = (product, model) => {
    // filter product mapping with model
    if (model !== undefined) {
        product = modelMapper(product, model)
    }

    // array converter
    if (product.tag !== undefined) product.tag = product.tag.split(",")
    if (product.size !== undefined) product.size = product.size.split(",")
    if (product.images !== undefined) product.images = product.images.split(",")

    if (product.createdAt !== undefined) product.createdAt = dateTimeZoneNow(product.createdAt);
    if (product.updatedAt !== undefined) product.updatedAt = dateTimeZoneNow(product.updatedAt);
    return product
}

module.exports = router