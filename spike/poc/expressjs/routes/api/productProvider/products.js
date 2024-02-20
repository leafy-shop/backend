const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateDouble, validateEmail, validateStrArray, validateRole } = require('../../validation/body')
const { notFoundError, forbiddenError, validatError } = require('../../model/error/error')
// const { dateTimeZoneNow } = require('../model/class/utils/datetimeUtils')
const { userViewFav, prodList, reviewView, reviewViewOwner } = require('../../model/class/model')
const { JwtAuth, verifyRole, UnstrictJwtAuth } = require('../../../middleware/jwtAuth')

const { PrismaClient, Prisma } = require('@prisma/client');
// const { deleteNullValue } = require('../model/class/utils/modelMapping');
// const { mode } = require('../../config/minio_config');
const { productConverter, timeConverter, paginationList, generateId } = require('../../model/class/utils/converterUtils');
const { ROLE } = require('../../model/enum/role');
const { findImagePath, listFirstImage, listAllImage } = require('../../model/class/utils/imageList');
const prisma = new PrismaClient()
// const crypto = require("crypto");
// const { DateTime } = require("luxon");
const { deleteNullValue } = require('../../model/class/utils/modelMapping')
const { getDifferentTime } = require('../../model/class/utils/datetimeUtils');
const { ITEMTYPE, ITEMSIZE, ITEMEVENT } = require('../../model/enum/item');
const axios = require("axios")
const http = require('http');

const dotenv = require('dotenv');
const { error } = require('console');
const { resolve } = require('path');
const { getTopItems } = require('../../model/recommender/contentBasedFiltering');

// get config vars
dotenv.config();

const url = process.env.ML_HOST

// product demo
// const product_db = [
//     {
//         "name": "small zee cactus",
//         "description": "this is cactus create by zee",
//         "itemOwner": "piraphat123@gmail.com",
//         "type": "cactus",
//         "tag": ["cactus is amazing", "flower cactus", "cactus", "", "cactus", "Cactus"],
//         "size": ["XS", "S"],
//         "style": "light green cactus",
//         "price": 32,
//     },
//     {
//         "name": "lilac flower in beautiful jar",
//         "description": "this is lilac flower create by zee",
//         "itemOwner": "piraphat123@gmail.com",
//         "type": "flower",
//         "tag": ["lilac is relax", "levender flower", "", null, " "],
//         "size": ["S", "M", "l", "L"],
//         "style": "light purple flower",
//         "price": 149
//     },
//     {
//         "name": "golden rose",
//         "itemOwner": "piraphat123@gmail.com",
//         "type": "flower",
//         "tag": ["rose", "golden rose", "Rose", null, " "],
//         "size": ["S", "M", "l", "XL"],
//         "style": "golden",
//         "price": 289
//     },
//     {
//         "name": "big zee cactus",
//         "description": "this is very BIG cactus create by zee",
//         "itemOwner": "piraphat123@gmail.com",
//         "type": "cactus",
//         "tag": ["cactus", "very cute", "very fat and high"],
//         "size": ["l", "xL"],
//         "style": "golden",
//         "price": 570
//     },
//     {
//         "name": "zee shovel",
//         "itemOwner": "piraphat123@gmail.com",
//         "type": "tool",
//         "tag": ["shovel", "tool"],
//         "style": "shapen shovel",
//         "price": 139
//     }
// ]

// GET - all page products by filter and sort
router.get('/', UnstrictJwtAuth, async (req, res, next) => {
    // let filter_pd = product_db.filter( p => {
    //     console.log(p)
    //     return (req.query.product == undefined ? true : p.product.includes(req.query.product)) &&
    //     (req.query.price == undefined ? true : req.query.price == p.price)
    // })
    // filter_pd = filter_pd.sort( (a,b) => b[req.query.sort] - a[req.query.sort] )
    // let sorting = req.query.sort == 'desc' ? 'desc' : 'asc'

    // query params
    let { page, limit,
        isFav, product, min_price, max_price, rating, owner,
        type, tag,
        sort_name, sort, isRecommend } = req.query

    // count items
    // let count_pd = await prisma.items.count()
    // console.log(count_pd)

    // console.log(!! req.query.isFav)
    // console.log(Boolean(req.query.isFav))

    // favFilter mode by show some user who are favorite
    let favFilter = (req.user === undefined || isFav === undefined || isFav.toLocaleLowerCase() !== 'true') ? {} : { some: { userEmail: req.user.email } }

    // page number and page size
    let pageN = Number(page)
    let limitN = Number(limit)
    // console.log(limit)

    // customize sorting model
    let sortModel = {}
    if (sort_name == "price") {
        sortModel.minPrice = (sort === "desc") ? "desc" : "asc"
    } else if (sort_name == "sales") {
        sortModel.sold = (sort === "desc") ? "desc" : "asc"
    } else if (sort_name == "new_arrival") {
        sortModel.createdAt = (sort === "desc") ? "desc" : "asc"
    }
    // else if (sort_name == "popular") {
    // }
    else {
        sortModel.updatedAt = "desc"
    }

    // rating scale format for filter
    let ratingScale = [[0, 1.9], [2, 2.9], [3, 3.9], [4, 4.9], [5, 5]]

    // console.log(rating)
    // console.log(isNaN(rating) ? undefined : ratingScale[rating - 1][0])
    // console.log(isNaN(rating) ? undefined : ratingScale[rating - 1][1])

    // filter single and between value from name, price, rating and isFavPrd query
    // and return page that sorted by updateAt item
    try {
        let filter_pd = []
        // if sort data or sort method or favorite product it will get mandatory data from database
        if (sort_name !== undefined || ['asc', 'desc'].includes(sort) || isFav == 'true') {
            filter_pd = await prisma.items.findMany({
                include: {
                    favprd: true
                },
                where: {
                    AND: [{
                        name: {
                            contains: product
                        },
                        minPrice: {
                            lte: max_price,
                            gte: min_price
                        },
                        totalRating: {
                            gt: isNaN(rating) ? undefined : ratingScale[rating - 1][0],
                            lte: isNaN(rating) ? undefined : ratingScale[rating - 1][1]
                        },
                        favprd: favFilter,
                        itemOwner: owner
                    }]
                },
                include: {
                    favprd: false,
                },
                orderBy: sortModel
            })
        } else {
            // if not have sort data or sort method or favorite product it will get recommend product by check on account
            let pds = await prisma.items.findMany()
            if (isRecommend === "true") {
                let event = await prisma.item_events.findMany({ include: { items: true } })
                event = event.map(event => {
                    event.itemPrice = event.items.minPrice
                    event.itemRating = event.items.totalRating
                    event.itemType = event.items.type
                    delete event["items"]
                    return event
                })

                let category = []
                let weight = {}
                // user case
                if (req.user !== undefined) {

                    // list latest user activities on event 
                    let mockUser = await prisma.item_events.findMany({
                        where: { userId: req.user.id },
                        include: { items: true },
                        orderBy: { timestamp: "desc" },
                        take: 3
                    })

                    // join mockUser to item data
                    mockUser = mockUser.map(event => {
                        // console.log(event)
                        event.itemType = event.items.type
                        event.itemPrice = event.items.minPrice
                        event.itemRating = event.items.totalRating
                        event.itemEvent = (event.itemEvent === ITEMEVENT.View ? 0.5 : event.itemEvent === ITEMEVENT.ATC ? 0.75 : 1)
                        delete event["items"]
                        return event
                    })
                    // console.log(mockUser)

                    // map latest category when user see
                    category = mockUser.map(event => event.itemType)

                    // average weight before content based filtering
                    avg_event = mockUser.reduce((pre, cur) => pre + Number(cur.itemEvent), 0) / 3
                    avg_rating = mockUser.reduce((pre, cur) => pre + Number(cur.itemRating), 0) / 3
                    avg_price = mockUser.reduce((pre, cur) => pre + Number(cur.itemPrice) / 100, 0) / 3

                    weight = {
                        totalRating: avg_rating,
                        itemEvent: avg_event,
                        itemPrice: avg_price,
                    }
                
                // guest case
                } else {
                    // list latest user activities on event 
                    let mockUser = await prisma.item_events.findMany({
                        include: { items: true },
                        orderBy: { timestamp: "desc" },
                        take: 50 // note this value can be change when user capacity is increase.
                    })

                    // join mockUser to item data
                    mockUser = mockUser.map(event => {
                        // console.log(event)
                        event.itemType = event.items.type
                        event.itemPrice = event.items.minPrice
                        event.itemRating = event.items.totalRating
                        event.itemEvent = (event.itemEvent === ITEMEVENT.View ? 0.5 : event.itemEvent === ITEMEVENT.ATC ? 0.75 : 1)
                        delete event["items"]
                        return event
                    })
                    // console.log(mockUser)

                    // map latest category when user see
                    category = mockUser.map(event => event.itemType).slice(-4,-1)
                    // console.log(category)

                    // average weight before content based filtering
                    avg_event = mockUser.reduce((pre, cur) => pre + Number(cur.itemEvent), 0) / (mockUser.length > 50 ? 50 : mockUser.length)
                    avg_rating = mockUser.reduce((pre, cur) => pre + Number(cur.itemRating), 0) / (mockUser.length > 50 ? 50 : mockUser.length)
                    avg_price = mockUser.reduce((pre, cur) => pre + Number(cur.itemPrice) / 100, 0) / (mockUser.length > 50 ? 50 : mockUser.length)
                    // console.log(avg_event)
                    // console.log(avg_rating)
                    // console.log(avg_price)

                    weight = {
                        totalRating: avg_rating,
                        itemEvent: avg_event,
                        itemPrice: avg_price,
                    }
                }
                // console.log(weight)
                topItem = getTopItems(event, category, weight, pds.length)
                // console.log(topItem)
                topItem.forEach(item => {
                    filter_pd.push(pds.filter(pd => item.itemId === pd.itemId)[0])
                })
                console.log(filter_pd)
            } else {
                filter_pd = pds
            }
            // console.log(filter_pd)
            filter_pd = filter_pd.filter(prod => {
                return (product !== undefined ? prod.name.includes(product) : true) &&
                    (min_price !== undefined ? Number(prod.minPrice) > min_price : true) &&
                    (max_price !== undefined ? Number(prod.minPrice) < max_price : true) &&
                    (isNaN(rating) || rating === undefined ? true : (Number(prod.totalRating) >= ratingScale[rating - 1][0] && Number(prod.totalRating) <= ratingScale[rating - 1][1])) &&
                    (owner !== undefined ? prod.itemOwner == owner : true)
            })
            // console.log(filter_pd)
        }

        // filter includes array : complexity best case O(n), worst case O(n*(type+tag))
        filter_pd = filter_pd.filter(product => {
            condition = (type === undefined ? true : type.split(",").includes(product.type)) &&
                // (tag === undefined ? true : product.tag.split(",").includes(tag))
                (tag === undefined ? true : tag.split(",").some(r => product.tag.split(",").includes(r)))
            // console.log(type.split(","))
            // console.log(product.type)
            // console.log(type.split(",").includes(product.type))

            // https://stackoverflow.com/questions/16312528/check-if-an-array-contains-any-element-of-another-array-in-javascript

            // if (product.itemId=="30002") {
            //     console.log(tag.split(","))
            //     console.log(product.tag.split(","))
            //     console.log(tag.split(",").some(r => product.tag.split(",").includes(r)))
            //     console.log(condition)
            // }
            return condition
        })

        // check if user is supplier then cannot see owner product except when he get owner item
        if (req.user !== undefined && req.user.role === ROLE.Supplier && owner === undefined) filter_pd = filter_pd.filter(product => product.itemOwner !== req.user.email)

        outOfStock(filter_pd).then(outStockData => {
            // filter product have some item on stock
            filter_pd = filter_pd.filter(product => {
                // console.log(outStockData.filter(out => out.itemId == product.itemId))
                return !outStockData.filter(out => out.itemId == product.itemId).length
            })

            // managed out product by limit 6 product
            let itemOutStock = []
            for (let i = 0; i < ((outStockData.length < 5) ? outStockData.length : 5); i++) {
                itemOutStock.push(outStockData[i])
            }

            // return to page with page number and page size
            page_pd = paginationList(filter_pd, pageN, limitN, 18)

            // array converter and image mapping
            Promise.all(
                // list product with image
                page_pd.list.length === 0 ? [] :
                    page_pd.list.map(product => getProductImage(productConverter(product, prodList)))
                // filter_pd.map(product => productConverter(product, prodList))
            ).then(productList => {
                // item is founded
                page_pd.list = productList

                // provided outstock product
                Promise.all(
                    itemOutStock.length === 0 ? [] :
                        itemOutStock.map(product => getProductImage(productConverter(product, prodList)))
                ).then(outStockData => {
                    page_pd.outStock = outStockData
                    return res.send(page_pd)
                }).catch(err => {
                    next(err)
                })
            }).catch(err => {
                next(err)
            })
        }).catch(error => {
            next(error)
        });

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

let outOfStock = async (filter_pd) => {
    let filteredProducts = await Promise.all(
        filter_pd.map(async (product) => {
            let productStock = await prisma.item_details.findMany({
                select: {
                    stock: true
                },
                where: {
                    itemId: product.itemId
                }
            });
            // console.log(productStock, productStock.every(stock => stock.stock < 1));
            return {
                product: product,
                isOutOfStock: productStock.every(stock => stock.stock < 1)
            };
        })
    );

    return filteredProducts.filter(item => item.isOutOfStock).map(item => item.product);
}

// // get recommender by fetch api on FastAPI
// let getRecommender = async (pds, id) => {
//     let filter_pd = []
//     try {
//         let { data, status } = await axios.get(url + '/ml/recommend?user_id=' + id)
//         data.forEach(prodId => {
//             filter_pd.push(pds.filter(prod => prod.itemId == prodId)[0])
//         })
//         console.log(filter_pd)
//         return filter_pd
//     } catch (err) {
//         return pds
//     }
// }

// GET - products by id
router.get('/:id', UnstrictJwtAuth, async (req, res, next) => {
    try {
        // find id of product
        let item = await verifyId(req.params.id)

        // find item_details and map to item
        item.styles = await prisma.item_details.findMany({
            where: {
                itemId: item.itemId
            }
        })

        // check user is supplier
        // if (req.user !== undefined && req.user.role === ROLE.Supplier && item.itemOwner !== req.user.email)
        //     forbiddenError("This supplier can view owner's item only")

        // image for product
        let path = findImagePath("products", item.itemId)
        item.image = await listFirstImage(path, "main.png")
        // console.log(item.image)

        // list product review to page
        page = Number(req.query.rv_page)
        limit = Number(req.query.rv_limit)

        // add on event
        console.log(req.user)
        if (req.user !== undefined) {
            let event = {
                userId: req.user.id,
                itemId: item.itemId,
                itemEvent: ITEMEVENT.View,
            }
            await prisma.item_events.create({
                data: event
            })
        }

        // item.item_reviews = paginationList(item.item_reviews, page, limit, 5)

        // // return product by id
        // return res.json(item)

        // array converter and image mapping
        Promise.all(
            // list product style with image
            item.styles.map(product => getProductStyleImage(productConverter(product)))
            // filter_pd.map(product => productConverter(product, prodList))
        ).then(styles => {
            item.styles = styles
            // return converter of product
            return res.json(productConverter(item))
        }).catch(err => {
            next(err)
        })
    } catch (err) {
        next(err)
    }
})

// POST - create product and product details
router.post('/', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    let { itemId, name, description, itemOwner, type, tag, styles } = req.body
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
    //     "styles": [
    //         {
    //             "style": "light green cactus",
    //             "size": ["XS","S"]
    //         },{
    //             "style": "green cactus",
    //             "size": ["S"]
    //         }
    //     ],
    //     "price": 32
    // }

    // created product from request body and validation
    try {
        // check if supplier role delete other email
        // if (req.user.role == ROLE.Supplier && itemOwner !== req.user.email)
        //     forbiddenError("This supplier can create owner's item only")

        let priceRange = {}
        let priceList = []
        let styleList = []
        let sizeList = []
        if (styles.length === 0 || !Array.isArray(styles)) {
            validatError("created item must be have 1 style item")
        }
        styles.forEach(sty => {
            if (sty.price === undefined) {
                validatError("item detail must be have price")
            }
            // console.log(sty)
            sty.style = sty.style === undefined || sty.style.length === 0 ? "No" : sty.style
            styleList.push(validateStr("item style:" + sty.style, sty.style, 50))
            sty.size = sty.size === undefined || sty.style.length === 0 ? ITEMSIZE.No : sty.size
            sizeList.push(validateStr("item size:" + sty.style, sty.size, 50))
            validateInt("item stock:" + sty.style, sty.stock, false, 0)
            priceList.push(validateDouble("item price:" + sty.price, sty.price, false, 0))
        })
        styles.forEach(sty => {
            if (styleList.includes("No") && sty.style !== "No") {
                validatError("item detail style if no style must cannot add another style")
            }
            if (sizeList.includes("No") && sty.size !== "No") {
                validatError("item detail size if no size must cannot add another style")
            }
        })
        priceRange.minPrice = Math.min(...priceList)
        priceRange.maxPrice = Math.max(...priceList) !== priceRange.minPrice ? Math.max(...priceList) : 0

        let itemModel = {
            itemId: isNaN(itemId) ? undefined : validateInt("item id", itemId, true),
            name: validateStr("item name", name, 100),
            description: validateStr("item description", description, 5000, true),
            type: validateRole("item type", type, ITEMTYPE),
            tag: validateStrArray("item tag", tag, 10, 20),
            minPrice: priceRange.minPrice,
            maxPrice: priceRange.maxPrice
        }

        if (req.user.role == ROLE.Admin) {
            itemModel.itemOwner = validateEmail("item owner", itemOwner, 100)
        } else {
            itemModel.itemOwner = req.user.email
        }

        // create item with email owner
        let input = await prisma.items.create({
            data: itemModel
        })

        const item_detail = styles.map((sty) => {
            console.log(input.itemId, sty.style, sty.size)
            return prisma.item_details.create({
                data: {
                    itemId: input.itemId,
                    style: sty.style,
                    // size: (sty.sizes.length !== 0 && Array.isArray(sty.sizes)) ? validateStrArray('validate size', sty.sizes.map(size => validateRole('validate inner size', size, ITEMSIZE)), 5, 4, true) : undefined
                    size: sty.size,
                    stock: sty.stock,
                    price: sty.price
                }
            })
        }
        )

        Promise.all(item_detail)
            .then(data => {
                input.styles = data
                return res.status(201).json(productConverter(input))
            })
            .catch(err => {
                next(err)
            })

    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.meta.target === 'PRIMARY') {
                err.message = "product of user is duplicated"
            }
        }
        next(err)
    }
})

// router.post('/addtocart', JwtAuth, async (req, res, next) => {
//     let { productId, qty } = req.body

//     try {
//         let choosePd = await verifyId(productId)

//         let cart = await prisma.carts.aggregate({
//             _sum: {
//                 qty: true
//             },
//             where: {
//                 AND: [
//                     { productId: choosePd.productId },
//                     { isPaid: false }
//                 ]
//             }
//         })

//         if (cart._sum.qty + validateInt("quantity", qty, true) > choosePd.stock) validatError(`product ${productId}:${choosePd.product} have quantity more than their stocks`)

//         let input = await prisma.carts.create({
//             data: {
//                 userEmail: req.user.email,
//                 productId: productId,
//                 qty: qty
//             }
//         })
//         return res.status(201).json({ msg: `your product ${choosePd.productId} ${choosePd.product} - ${choosePd.price} baht that add in your cart` })
//     } catch (err) {
//         next(err)
//     }
// })

// PUT - change favorite product by id
router.put('/isFav/:id', JwtAuth, verifyRole(ROLE.Admin, ROLE.User), async (req, res, next) => {
    try {
        let item = await verifyId(Number(req.params.id))
        let userMatching = await findFavPdById(req.user.email,
            // find product by id
            item.itemId)
        // if user hasn't favorite in this product id then add favorite product item
        if (userMatching == null) {
            await prisma.favprd.create({
                data: {
                    userEmail: req.user.email,
                    itemId: item.itemId
                }
            })
            // if user has favorite in this product id then clear favorite product item
        } else {
            await prisma.favprd.delete({
                where: {
                    itemId_userEmail: {
                        itemId: item.itemId,
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

// PATCH - update product by id
router.patch('/:id', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    let mapData = {}

    // body params mapping
    for (let i in req.body) {
        if (req.body[i] != undefined) {
            // map object from body when update in prisma model
            mapData[i] =
                i == "name" ? validateStr("item name", req.body[i], 100) :
                    i == "description" ? validateStr("item description", req.body[i], 5000, true) :
                        // i == "itemOwner" ? validateEmail("item owner", req.body[i], 100) : cannot change item owner
                        i == "type" ? validateStr("item type", req.body[i], 20) :
                            i == "tag" ? validateStrArray("item tag", req.body[i], 10, 20) : undefined // unused body request
        }
    }

    // update product
    try {
        // find item id
        let item = await verifyId(req.params.id)

        // check if supplier role update other email
        if (req.user.role == ROLE.Supplier && item.itemOwner !== req.user.email)
            forbiddenError("This supplier can update owner's item only")

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

// PUT - update product detail by id and style
router.put('/:id/:style/:size', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    // update product

    let { price, stock, style, size } = req.body

    try {
        // find item id
        let item = await verifyDetailId(req.params.id, req.params.style, req.params.size)

        // check if supplier role update other email
        if (req.user.role == ROLE.Supplier && item.itemOwner !== req.user.email)
            forbiddenError("This supplier can update owner's item only")

        // check that product is found
        if (item == null) notFoundError("item id " + id + " does not exist")

        // switch out of stock or not
        let itemModel = {
            itemId: Number(req.params.id),
            style: style !== undefined ? validateStr("validate item price", style, 50) : req.params.style,
            size: size !== undefined ? validateStr('validate item size', size, 50) : req.params.size,
            price: validateDouble("validate item price", price, false, 0),
            stock: validateInt('validate item stock', stock, false, 0)
        }

        // update stock
        let input = await prisma.item_details.update({
            where: {
                itemId_style_size: {
                    itemId: Number(req.params.id),
                    style: req.params.style,
                    size: req.params.size
                }
            },
            data: itemModel
        })
        // return update product converter
        return res.json(productConverter(input))
    } catch (err) {
        // if product is not found
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "item id " + req.params.id + " in style " + " does not exist"
            }
        }
        next(err)
    }
})

// DELETE - delete product
router.delete('/:id', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    try {
        // find item id
        let item = await verifyId(req.params.id)

        // check if supplier role delete other email
        if (req.user.role == ROLE.Supplier && item.itemOwner !== req.user.email)
            forbiddenError("This supplier can delete owner's item only")

        // find id to delete product
        let input = await prisma.items.delete({
            where: {
                itemId: validateInt("itemId", Number(req.params.id)),
            }
        })
        return res.json({ message: "item id " + req.params.id + " has been deleted" })
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

// review -- zone ---

// GET - get all reviews
router.get('/all/reviews', async (req, res, next) => {

    // query params
    let { page, limit } = req.query

    // page number and page size
    let pageN = Number(page)
    let limitN = Number(limit)

    // filter single and between value from name, price, rating and isFavPrd query
    // and return page that sorted by updateAt item
    try {
        let filter_rv = await prisma.item_reviews.findMany({
            where: {
                rating: {
                    gte: 3,
                    lte: 5
                },
            },
            select: reviewView,
            orderBy: { createdAt: "desc" }
        })

        let avg_rating = await prisma.item_reviews.aggregate({
            _avg: {
                rating: true
            },
        })

        // return to page with page number and page size
        let page_rv = paginationList(filter_rv, pageN, limitN, 10)
        // return average review
        page_rv.avg_rating = avg_rating._avg.rating
        // console.log(page_rv.list)
        page_rv.list = page_rv.list.map(rv => {
            rv.name = rv.accounts.username
            rv.accounts = undefined
            // Replace this with the IANA timezone you desire
            rv.time = getDifferentTime(rv.createdAt)
            rv.createdAt = undefined
            return rv
        })

        return res.send(page_rv)

    } catch (err) {
        next(err)
    }
})

// GET - get all review in product id
router.get('/:prodId/reviews', UnstrictJwtAuth, async (req, res, next) => {
    try {
        // query params
        let { page, limit, sort, style } = req.query

        // page number and page size
        let pageN = Number(page)
        let limitN = Number(limit)

        // find item id
        let item_reviews = await findAllReviewByItemId(req.params.prodId, sort, style)

        // review item with pagination
        item_reviews = paginationList(item_reviews, pageN, limitN, 5)

        Promise.all(
            // change time zone and icon
            item_reviews.list.length === 0 ? [] :
                item_reviews.list.map(review => {
                    // Replace this with the IANA timezone you desire
                    review.time = getDifferentTime(review.createdAt)
                    review.createdAt = undefined
                    review.size = review.size == "No" ? undefined : review.size
                    return getIconImage(deleteNullValue(review))
                })
        ).then(data => {
            // console.log(data)
            item_reviews.list = data
            // console.log(item_reviews.list)
            return res.send(item_reviews)
        })
            .catch(err => {
                next(err)
            })
    } catch (err) {
        next(err)
    }
})

// POST - add reviews into product id
router.post('/:prodId/reviews', JwtAuth, async (req, res, next) => {
    try {
        let { itemReviewId, comment, rating, style, size } = req.body

        // find item id
        let item = await verifyDetailId(req.params.prodId, style, size)

        // // check size
        // if (!item.styles[0].size.includes(size)) notFoundError(`item id ${item.itemId} size not found `)

        // generate id
        const id = generateId(16)

        // console.log(id.length); // => f9b327e70bbcf42494ccb28b2d98e00e

        // console.log(itemReviewId)

        // add this user for comment
        let review = await prisma.item_reviews.create({
            data: {
                itemReviewId: itemReviewId !== undefined ? itemReviewId : id,
                itemId: item.itemId,
                userEmail: req.user.email,
                comment: validateStr("item comment", comment, 200),
                rating: validateInt("item rating", rating, 500, 1, 5),
                size: size,
                style: style
            }
        })

        // change average of rating in this item
        await changeTotalRating(item.itemId)

        return res.json(timeConverter(review))
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2002') {
                err.message = "item review is duplicated"
            }
            if (err.code === 'P2025') {
                err.message = "item id " + req.params.prodId + " does not exist"
            }
        }
        next(err)
    }
})


// DELETE - delete review by review id and product id
router.delete('/:prodId/reviews/:commentId', JwtAuth, async (req, res, next) => {
    try {
        let { prodId, commentId } = req.params

        // find item id
        let item = await findReviewById(prodId, commentId)

        // check if supplier role delete other email that not same finding commend that throw to exception
        if ([ROLE.Supplier, ROLE.User].includes(req.user.role) && review.userEmail !== req.user.email) forbiddenError("user can delete your comment only")

        // find id to delete product
        await prisma.item_reviews.delete({
            where: {
                itemReviewId: commentId
            }
        })

        // change average of rating in this item
        await changeTotalRating(item.itemId)

        return res.json({ message: "item review id " + commentId + " has been deleted" })
    } catch (err) {
        // if product is not found
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "item review id " + req.params.commentId + " does not exist"
            }
        }
        next(err)
    }
})

// PUT - like review by review id and product id
router.put('/:prodId/reviews/:commentId/like', JwtAuth, async (req, res, next) => {
    try {
        let { prodId, commentId } = req.params

        // get average value of rating in item id
        let review = await findReviewById(prodId, commentId)
        let like = await findReviewLike(req.user.email, commentId)

        let comment
        // check if review is undefined
        if (like === null) {
            // add like message on log
            let input = await prisma.item_review_likes.create({
                data: {
                    itemReviewId: commentId,
                    userEmail: req.user.email
                }
            })

            // update like in item id
            comment = await prisma.item_reviews.update({
                data: {
                    like: {
                        increment: 1
                    }
                },
                where: {
                    itemReviewId: input.itemReviewId,
                    itemId: Number(prodId)
                }
            })
        } else {
            // revert like message on log
            await prisma.item_review_likes.delete({
                where: {
                    itemReviewId_userEmail: {
                        itemReviewId: commentId,
                        userEmail: req.user.email
                    }
                }
            })

            // console.log(prodId.userEmail)

            // update unlike in item id
            comment = await prisma.item_reviews.update({
                data: {
                    like: {
                        decrement: 1
                    }
                },
                where: {
                    itemReviewId: review.itemReviewId,
                    itemId: Number(prodId)
                }
            })
        }

        return res.json(timeConverter(comment))
    } catch (err) {
        // if product is not found
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "item review id " + req.params.commentId + " does not exist"
            }
        }
        next(err)
    }
})

// -- method zone --
const getProductImage = async (product) => {
    product.image = await listFirstImage(findImagePath("products", product.itemId), "main.png")
    // console.log(product.image)
    return product
}

const getProductStyleImage = async (style) => {
    style.images = await listAllImage(findImagePath("products", style.itemId + '/' + style.style))
    return style
}

const getIconImage = async (user) => {
    user.image = await listFirstImage(findImagePath("users", user.userId), "main.png")
    // console.log(user)
    return user
}

const verifyId = async (id) => {
    // find product by id
    let item = await prisma.items.findFirst({
        where: {
            itemId: Number(id)
        }
        // include: {
        //     item_reviews: {
        //         orderBy: {
        //             createdAt: "desc"
        //         }
        //     }
        // }
    })

    // check that product is found
    if (item == null) notFoundError("item id " + id + " does not exist")

    // item.styles = await item.styles.map(async style => {
    //     style.image = await getAllStyleImageItem(findImagePath('products', style.itemId + "/" + style.style))
    //     console.log(style)
    //     return style
    // })

    // console.log(item.styles)
    return item
}

// use model for add to cart and check stock
const verifyDetailId = async (id, sty, size = "No") => {
    // find product by id
    let item_detail = await prisma.item_details.findFirst({
        where: {
            AND: [
                { itemId: Number(id) },
                { style: sty },
                { size: size }
            ]
        }
    })

    // check that product is found
    if (item_detail == null) notFoundError("item id " + id + " in style " + sty + " have size " + size + " does not exist")

    // check that item owner
    let item = await prisma.items.findFirst({
        where: { itemId: item_detail.itemId }
    })

    item.styles = [item_detail]

    // return converter of product
    return productConverter(item)
}

const verifyUserEmail = async (userEmail) => {
    // find user by account email
    let filter_user = await prisma.accounts.findFirst({
        select: userViewFav(),
        where: {
            email: userEmail
        }
    })

    // check user exist
    if (filter_user == null) notFoundError("user email " + email + " does not exist")

    // time format
    filter_user = timeConverter(filter_user)

    // fav product converter
    filter_user.favprd = filter_user.favprd.map(favprd => {
        return productConverter(favprd.items)
    })
    return filter_user
}

const findAllReviewByItemId = async (prodId, sort, name = undefined) => {
    let sortModel = (sort === 'newest' ? { createdAt: 'desc' } : sort === 'oldest' ? { createdAt: 'asc' } : undefined)

    console.log(name)

    // get review by itemReview, item id and user email
    let review = await prisma.item_reviews.findMany({
        where: {
            AND: [{ itemId: Number(prodId) },
            { style: name }]
        },
        select: reviewViewOwner,
        orderBy: sortModel
    })

    // check that product is found
    if (review == null) notFoundError("item id " + prodId + " does not exist")

    // changing username to name
    review = review.map(rv => {
        rv.username = rv.accounts.username
        rv.userId = rv.accounts.userId
        rv.accounts = undefined
        return rv
    })

    return review
}

const changeTotalRating = async (id) => {
    // get average value of rating in item id
    avg_review = await prisma.item_reviews.aggregate({
        _avg: {
            rating: true
        },
        where: {
            itemId: id
        }
    })

    // update average rating in item id
    await prisma.items.update({
        data: {
            totalRating: avg_review._avg.rating.toFixed(1)
        },
        where: {
            itemId: id
        }
    })
    return avg_review
}

const findReviewById = async (prodId, commendId) => {
    // get review by itemReview, item id and user email
    let review = await prisma.item_reviews.findFirst({
        where: {
            AND: [
                { itemReviewId: commendId },
                { itemId: Number(prodId) },
            ]
        }
    })

    // check that product is found
    if (review == null) notFoundError("item review id " + commendId + " does not exist")

    return review
}

const findReviewLike = async (email, commendId) => {
    // get review by itemReview, item id and user email
    let like = await prisma.item_review_likes.findFirst({
        where: {
            AND: [
                { itemReviewId: commendId },
                { userEmail: email }
            ]
        }
    })

    return like
}


const findFavPdById = async (email, id) => {
    // find product that match to user email
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

module.exports = router