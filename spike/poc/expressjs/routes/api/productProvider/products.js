const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateDouble, validateEmail, validateStrArray, validateRole, validateIdForTesting } = require('../../validation/body')
const { notFoundError, forbiddenError, validatError } = require('../../model/error/error')
// const { dateTimeZoneNow } = require('../model/class/utils/datetimeUtils')
const { userViewFav, prodList, reviewView, reviewViewOwner, reviewViewOrder } = require('../../model/class/model')
const { JwtAuth, verifyRole, UnstrictJwtAuth } = require('../../../middleware/jwtAuth')

const { PrismaClient, Prisma } = require('@prisma/client');
// const { deleteNullValue } = require('../model/class/utils/modelMapping');
// const { mode } = require('../../config/minio_config');
const { productConverter, timeConverter, paginationList, generateIdByMapping, reviewConvertor } = require('../../model/class/utils/converterUtils');
const { ROLE } = require('../../model/enum/role');
const { ORDERSTATUS } = require('../../model/enum/order');
const { findImagePath, listFirstImage, listAllImage } = require('../../model/class/utils/imageList');
const prisma = new PrismaClient()
// const crypto = require("crypto");
// const { DateTime } = require("luxon");
const { deleteNullValue, sanitizeCircularReferences } = require('../../model/class/utils/modelMapping')
const { getDifferentTime, addHours } = require('../../model/class/utils/datetimeUtils');
const { ITEMTYPE, ITEMSIZE, ITEMEVENT } = require('../../model/enum/item');

const dotenv = require('dotenv');
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
        isFav, isRecommend,
        product,
        min_price, max_price, rating, owner, type, tag,
        sort_name, sort } = req.query

    // count items
    // let count_pd = await prisma.items.count()
    // console.log(count_pd)

    // console.log(!! req.query.isFav)
    // console.log(Boolean(req.query.isFav))

    // favFilter mode by show some user who are favorite
    let favFilter = (req.user === undefined || isFav === undefined || isFav.toLocaleLowerCase() !== 'true') ? {} : { some: { username: req.user.username } }

    // page number and page size
    let pageN = Number(page)
    let limitN = Number(limit)
    // console.log(limit)

    // customize sorting model
    let sortModel = {}
    if (sort_name == "price") {
        sortModel.minPrice = (sort === "desc") ? "desc" : "asc"
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
                        OR: [
                            {
                                name: {
                                    contains: product
                                }
                            },
                            {
                                description: {
                                    contains: product
                                }
                            },
                            {
                                itemOwner: {
                                    contains: product
                                }
                            }
                        ],
                        minPrice: {
                            lte: max_price,
                            gte: min_price
                        },
                        totalRating: {
                            gt: isNaN(rating) || (rating < 1 || rating > 5)  ? undefined : ratingScale[rating - 1][0],
                            lte: isNaN(rating) || (rating < 1 || rating > 5) ? undefined : ratingScale[rating - 1][1]
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
                let mockUser = []
                // user case
                if (req.user !== undefined) {
                    // list latest user activities on event 
                    mockUser = await prisma.item_events.findMany({
                        where: { userId: req.user.id },
                        include: { items: true },
                        orderBy: { timestamp: "desc" },
                        take: 6,
                        skip: 1
                    })

                    // guest case
                } else {
                    // list latest user activities on event 
                    mockUser = await prisma.item_events.findMany({
                        include: { items: true },
                        orderBy: { timestamp: "desc" },
                        take: 6, // note this value can be change when user capacity is increase.
                        skip: 1
                    })
                }

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

                // map latest category when user see
                category = mockUser.map(event => event.itemType)
                // console.log(category)

                // average weight before content based filtering
                avg_event = mockUser.reduce((pre, cur) => pre + Number(cur.itemEvent), 0) / (mockUser.length > 5 ? 5 : mockUser.length)
                avg_rating = mockUser.reduce((pre, cur) => pre + Number(cur.itemRating), 0) / (mockUser.length > 5 ? 5 : mockUser.length)
                avg_price = mockUser.reduce((pre, cur) => pre + Number(cur.itemPrice) / 100, 0) / (mockUser.length > 5 ? 5 : mockUser.length)
                // console.log(avg_event)
                // console.log(avg_rating)
                // console.log(avg_price)

                weight = {
                    totalRating: avg_rating,
                    itemEvent: avg_event,
                    itemPrice: avg_price,
                }
                // console.log(weight)
                // console.log(mockUser)
                topItem = getTopItems(event, category, weight, pds.length)

                topItem.forEach(item => {
                    filter_pd.push(pds.filter(pd => item.itemId === pd.itemId)[0])
                })
                // console.log(filter_pd)
            } else {
                filter_pd = pds
            }
            // console.log(filter_pd)
            filter_pd = filter_pd.filter(prod => {
                return (product !== undefined ? prod.name.toLowerCase().includes(product.toLowerCase()) || prod.description.toLowerCase().includes(product.toLowerCase()) || prod.itemOwner.toLowerCase().includes(product.toLowerCase()) : true) &&
                    (min_price !== undefined ? Number(prod.minPrice) > min_price : true) &&
                    (max_price !== undefined ? Number(prod.minPrice) < max_price : true) &&
                    (isNaN(rating) || rating === undefined || (rating < 1 || rating > 5) ? true : (Number(prod.totalRating) >= ratingScale[rating - 1][0] && Number(prod.totalRating) <= ratingScale[rating - 1][1])) &&
                    (owner !== undefined ? prod.itemOwner.toLowerCase() == owner.toLowerCase() : true)
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
        if (req.user !== undefined && req.user.role === ROLE.Supplier && owner === undefined) filter_pd = filter_pd.filter(product => product.itemOwner !== req.user.username)

        // outOfStock(filter_pd).then(outStockData => {
        //     // filter product have some item on stock
        //     filter_pd = filter_pd.filter(product => {
        //         // console.log(outStockData.filter(out => out.itemId == product.itemId))
        //         return !outStockData.filter(out => out.itemId == product.itemId).length
        //     })

        //     // managed out product by limit 6 product
        //     let itemOutStock = []
        //     for (let i = 0; i < ((outStockData.length < 5) ? outStockData.length : 5); i++) {
        //         itemOutStock.push(outStockData[i])
        //     }

        //     // return to page with page number and page size
        //     page_pd = paginationList(filter_pd, pageN, limitN, 18)

        //     // array converter and image mapping
        //     Promise.all(
        //         // list product with image
        //         page_pd.list.length === 0 ? [] :
        //             page_pd.list.map(product => getProductImage(productConverter(product, prodList)))
        //         // filter_pd.map(product => productConverter(product, prodList))
        //     ).then(productList => {
        //         // item is founded
        //         page_pd.list = productList

        //         // provided outstock product
        //         Promise.all(
        //             itemOutStock.length === 0 ? [] :
        //                 itemOutStock.map(product => getProductImage(productConverter(product, prodList)))
        //         ).then(outStockData => {
        //             page_pd.outStock = outStockData
        //             return res.send(page_pd)
        //         }).catch(err => {
        //             next(err)
        //         })
        //     }).catch(err => {
        //         next(err)
        //     })
        // }).catch(error => {
        //     next(error)
        // });

        // check item sold
        filter_pd = await Promise.all(filter_pd.map(async (product) => {
            return await haveItemSolesIn2Month(product)
        }))
        if (sort_name == "sales") {
            if (sort == "desc") {
                filter_pd = filter_pd.sort((a, b) => b.sold - a.sold)
            } else {
                filter_pd = filter_pd.sort((a, b) => a.sold - b.sold)
            }
        }

        // check out stock data
        const outStockData = await outOfStock(filter_pd);

        // Filter products that are in stock
        filter_pd = filter_pd.filter(product => {
            return !outStockData.some(out => out.itemId === product.itemId);
        });

        // Limit out-of-stock products to 5 items
        const itemOutStock = outStockData.slice(0, 5);

        // Paginate the filtered product list
        const page_pd = paginationList(filter_pd, pageN, limitN, 18);

        // Fetch images for in-stock products
        const productList = await Promise.all(page_pd.list.map(async (product) => {
            return await getProductImage(productConverter(product, prodList));
        }));

        page_pd.list = productList;

        // Fetch images for out-of-stock products
        const outStockImages = await Promise.all(itemOutStock.map(async (product) => {
            return await getProductImage(productConverter(product, prodList));
        }));

        page_pd.outStock = outStockImages;

        return res.send(page_pd);

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

router.get('/supplier/:owner', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    // query params
    let { page, limit, sort_name, sort, type } = req.query
    let { owner } = req.params

    // page number and page size
    let pageN = Number(page)
    let limitN = Number(limit)

    // customize sorting model
    let sortModel = {}
    if (sort_name == "latest") {
        sortModel.updatedAt = (sort === "desc") ? "desc" : "asc"
    } else if (sort_name == "price") {
        sortModel.minPrice = (sort === "desc") ? "desc" : "asc"
    } else {
        sortModel.updatedAt = "desc"
    }

    try {
        // validate supplier role 
        if (ROLE.Supplier === req.user.role && req.user.username !== owner) {
            forbiddenError("supplier can see yourself product only")
        }

        let filter_pd = await prisma.items.findMany({
            where: {
                AND: [
                    { type: type },
                    { itemOwner: owner }
                ]
            },
            include: {
                favprd: false,
            },
            orderBy: sortModel
        })

        // console.log(filter_pd)

        filter_pd = await Promise.all(filter_pd.map(async (product) => {
            let count = await prisma.item_details.aggregate({
                _sum: {
                    stock: true
                },
                where: {
                    itemId: product.itemId
                }
            })
            product.allStock = count._sum.stock
            return await haveItemSolesIn2Month(product)
        }))

        // check item sold
        if (sort_name === "sales") {
            if (sort === "desc") {
                filter_pd = filter_pd.sort((a, b) => b.sold - a.sold)
            } else {
                filter_pd = filter_pd.sort((a, b) => a.sold - b.sold)
            }
        } else if (sort_name === "soldout") {
            filter_pd = filter_pd.filter(product => product.allStock == 0)
        }

        // console.log(filter_pd)
        // Paginate the filtered product list
        const page_pd = paginationList(filter_pd, pageN, limitN, 10);

        // Fetch images for in-stock products
        const productList = await Promise.all(page_pd.list.map(async (product) => {
            prodList.description = true
            prodList.allStock = true
            return await getProductImage(productConverter(product, prodList));
        }));

        page_pd.list = productList;

        return res.send(page_pd);

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

// GET - products by id
router.get('/:id', UnstrictJwtAuth, async (req, res, next) => {
    try {
        // find id of product
        let item = await verifyId(validateInt("validate itemId", req.params.id))

        // find item_details and map to item
        let skuGroup = await prisma.item_sku.findMany({
            where: {
                itemId: item.itemId
            }
        })

        // console.log(skuGroup)

        // check user is supplier
        // if (req.user !== undefined && req.user.role === ROLE.Supplier && item.itemOwner !== req.user.email)
        //     forbiddenError("This supplier can view owner's item only")

        // image for product
        let path = findImagePath("products", item.itemId)
        item.image = await listFirstImage(path, "main.png")
        item = await haveItemSoles(item)
        // console.log(item.image)

        // add on event
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
        // Promise.all(
        //     // list product style with image
        //     item.styles.map(product => getProductStyleImage(productConverter(product)))
        //     // filter_pd.map(product => productConverter(product, prodList))
        // ).then(styles => {
        //     item.styles = styles
        //     // return converter of product
        //     return res.json(productConverter(item))
        // }).catch(err => {
        //     next(err)
        // })

        // style converter
        item.styles = []
        for (const sku of skuGroup) {
            const itemVariants = await prisma.item_details.findMany({
                where: {
                    AND: [
                        { itemId: sku.itemId },
                        { style: sku.SKUstyle }
                    ]
                }
            });

            const skuSizes = {
                style: sku.SKUstyle,
                sizes: [],
                minPriceSKU: Infinity,
                maxPriceSKU: -Infinity
            };

            const priceRange = [];
            const stockRange = [];
            itemVariants.forEach(product => {
                const { style, itemId, price, ...rest } = product;
                rest.price = parseFloat(price)
                priceRange.push(price);
                stockRange.push(rest.stock)
                skuSizes.sizes.push(rest);
                return { ...rest };
            });

            skuSizes.allStock = stockRange.reduce((pre, cur) => pre + cur, 0)

            skuSizes.minPriceSKU = Math.min(...priceRange);
            skuSizes.maxPriceSKU = priceRange.length <= 1 ? 0 : Math.max(...priceRange);

            const skuImage = await getProductStyleImage(sku.SKUstyle, sku.itemId);
            skuSizes.images = skuImage;

            // console.log(skuSizes.images)

            item.styles.push(skuSizes);
        }

        // console.log(item)

        // Respond with the updated product object
        return res.json(productConverter(item));
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
    //     "itemId": 20,
    //     "name": "small zee cactus",
    //     "description": "this is cactus create by zee",
    //     "itemOwner": "piraphat123",
    //     "type": "cactus",
    //     "tag": ["cactus is amazing","flower cactus","cactus","","cactus","Cactus"],
    //     "styles": [
    //         {
    //             "style": "sku-1",
    //             "sizes": [
    //                 { "size": "XS", "price": 12.00, "stock": 666 },
    //                 { "size": "S", "price": 24.00, "stock": 444 }
    //             ]
    //         },
    //         {
    //             "style": "sku-2",
    //             "sizes": [
    //                 { "size": "XS", "price": 32.00, "stock": 222 },
    //                 { "size": "S", "price": 64.00, "stock": 111 },
    //                 { "size": "M", "price": 96.00, "stock": 121 },
    //                 { "size": "L", "price": 128.00, "stock": 211 }
    //             ]
    //         }
    //     ]
    // }

    // created product from request body and validation
    try {
        // check if supplier role delete other email
        // if (req.user.role == ROLE.Supplier && itemOwner !== req.user.email)
        //     forbiddenError("This supplier can create owner's item only")

        let priceRange = {}
        let priceList = []
        console.log(styles)
        if (!Array.isArray(styles) || styles.length === 0) {
            validatError("created item must have at least 1 style item")
        }
        if (styles.length > 10) {
            validatError("This product already have maximum 10 sku per item so they cannot have sku anymore.")
        }
        let styleArray = []
        let sizeArray = []
        styles = styles.map(sty => {
            // console.log(sty)
            sty.style = sty.style === undefined || sty.style.length === 0 ? validatError("item detail must have sku style code") : validateStr("item sku style", sty.style, 20)
            sty.sizes = sty.sizes === undefined || sty.sizes.length === 0 ? validatError("item detail in sku must be have size") : sty.sizes
            if (sty.sizes.length > 10) {
                validatError("Product already have maximum 10 sizes per item sku so they cannot have sku anymore.")
            }
            if (styleArray.includes(sty.style)) {
                validatError("Creating product have duplicating sku style of " + sty.style)
            }
            styleArray.push(sty.style)
            sty.sizes = sty.sizes.map(size => {
                // console.log(size)
                size.size = validateStr("item size from " + sty.style, size.size, 50)
                size.price = validateDouble("item price from " + sty.style, size.price, false, 0)
                size.stock = validateInt("item stock from " + sty.style, size.stock, false, 1)
                priceList.push(size.price)
                if (sizeArray.includes(size.size)) {
                    validatError("Creating product have duplicating of sku style " + sty.style + " variant size " + size.size)
                }
                sizeArray.push(size.size)
                return size
            })
            sizeArray = []

            return sty
        })
        priceRange.minPrice = Math.min(...priceList)
        priceRange.maxPrice = Math.max(...priceList)

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
            itemModel.itemOwner = validateStr("item owner", itemOwner, 20)
        } else {
            itemModel.itemOwner = req.user.username
        }

        // create item with username owner
        let input = await prisma.items.create({
            data: itemModel
        })

        // create item sku mapping and item details
        await Promise.all(styles.map(async (sty) => {
            let sku = await prisma.item_sku.create({
                data: {
                    itemId: input.itemId,
                    SKUstyle: sty.style
                }
            });

            // using sku mapping to create
            sty.sizes = sty.sizes.map(size => {
                size.itemId = sku.itemId
                size.style = sku.SKUstyle
                return size
            })

            // console.log(sty.sizes)

            // Create item detail for each style
            return await prisma.item_details.createMany({
                data: sty.sizes
            });
        }));

        input.styles = styles;
        return res.status(201).json(productConverter(input));

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

// POST - create sku product
router.post('/:id', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    let { style, sizes } = req.body

    //         {
    //             "style": "sku-2",
    //             "sizes": [
    //                 { "size": "XS", "price": 32.00, "stock": 222 },
    //                 { "size": "S", "price": 64.00, "stock": 111 },
    //                 { "size": "M", "price": 96.00, "stock": 121 },
    //                 { "size": "L", "price": 128.00, "stock": 211 }
    //             ]
    //         }

    // created product from request body and validation
    try {
        // console.log(sty)
        let sizeArray = []
        style = style === undefined || style.length === 0 ? validatError("item detail must have sku style code") : validateStr("item sku style", style, 20)
        sizes = sizes === undefined || !Array.isArray(sizes) || sizes.length === 0 ? validatError("item detail in sku must be have size") : sizes
        if (sizes.length > 10) {
            validatError("Product already have maximum 10 sizes per item sku so they cannot have sku anymore.")
        }
        sizes = sizes.map(size => {
            // console.log(size)
            size.size = validateStr("item size from " + style, size.size, 50)
            size.price = validateDouble("item price from " + style, size.price, false, 0)
            size.stock = validateInt("item stock from " + style, size.stock, false, 1)
            if (sizeArray.includes(size.size)) {
                validatError("Creating product have duplicating of sku style " + style + " variant size " + size.size)
            }
            sizeArray.push(size.size)
            return size
        })

        // product Id 
        let product = await verifyId(validateInt("validate itemId", req.params.id))

        // check item owner
        if (req.user.role === ROLE.Supplier && req.user.username !== product.itemOwner) {
            forbiddenError("This supplier can create sku in owner's item only")
        }

        let skuProduct = await prisma.item_sku.count({
            where: {
                itemId: Number(req.params.id)
            }
        })

        if (skuProduct > 10) {
            validatError("This product already have maximum 10 sku per item so they cannot have sku anymore.")
        }

        // create item sku mapping and item details
        let sku = await prisma.item_sku.create({
            data: {
                itemId: product.itemId,
                SKUstyle: style,
            }
        });

        // using sku mapping to create
        sizes = sizes.map(size => {
            size.itemId = sku.itemId
            size.style = sku.SKUstyle
            return size
        })

        // Create item detail for each style
        await prisma.item_details.createMany({
            data: sizes
        });

        return res.status(201).json({ "message": "item sku:" + style + " has been added" });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.meta.target === 'PRIMARY') {
                err.message = "sku product of user is duplicated"
            }
        }
        next(err)
    }
})

// PUT - change favorite product by id
router.put('/isFav/:id', JwtAuth, verifyRole(ROLE.Admin, ROLE.User), async (req, res, next) => {
    try {
        let item = await verifyId(validateInt("validate itemId", req.params.id))
        let userMatching = await findFavPdById(req.user.username,
            // find product by id
            item.itemId)
        // if user hasn't favorite in this product id then add favorite product item
        if (userMatching == null) {
            await prisma.favprd.create({
                data: {
                    username: req.user.username,
                    itemId: item.itemId
                }
            })
            // if user has favorite in this product id then clear favorite product item
        } else {
            await prisma.favprd.delete({
                where: {
                    itemId_username: {
                        itemId: item.itemId,
                        username: req.user.username
                    }
                }
            })
        }
        return res.json(await verifyUsername(req.user.username))
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

    // update product
    try {
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

        // find item id
        let item = await verifyId(validateInt("validate itemId", req.params.id))

        // check if supplier role update other username
        if (req.user.role == ROLE.Supplier && item.itemOwner !== req.user.username)
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
router.put('/:id/:style', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    // update product
    let { id, style } = req.params
    let { sizes } = req.body
    let sizeArray = []

    try {
        if (sizes.length === 0 || !Array.isArray(sizes)) {
            validatError("updated item" + id + "sku style " + style + " must have at least 1 size item")
        }
        sizes = sizes.map(size => {
            // console.log(size)
            size.size = validateStr("item size", size.size, 50)
            size.price = validateDouble("item price", size.price, false, 0)
            size.stock = validateInt("item stock", size.stock, false, 1)
            if (sizeArray.includes(size.size)) {
                validatError("Creating product have duplicating of sku style " + style + " variant size " + size.size)
            }
            sizeArray.push(size.size)
            return size
        })

        // find item id
        let item = await verifyDetailId(id, style)

        // console.log(item)

        // check if supplier role update other username
        if (req.user.role == ROLE.Supplier && item.itemOwner !== req.user.username)
            forbiddenError("This supplier can update owner's item only")

        // delete all item sku
        await prisma.item_details.deleteMany({
            where: {
                AND: [
                    { itemId: Number(id) },
                    { style: style }
                ]
            }
        })

        // update item id and style
        sizes = sizes.map(size => {
            size.itemId = Number(id)
            size.style = style
            return size
        })

        // create item size converter
        await prisma.item_details.createMany({
            data: sizes
        })

        // console.log("T")

        // update item max price range
        let overallPrice = await prisma.item_details.findMany({
            where: {
                itemId: Number(id)
            },
            select: {
                price: true
            }
        })

        let priceArray = overallPrice.map(item => Number(item.price))

        if (item.maxPrice !== Math.max(...priceArray)) {
            await prisma.items.update({
                where: {
                    itemId: Number(id)
                },
                data: {
                    maxPrice: Math.max(...priceArray)
                }
            })
        }

        // update item min price range
        if (item.minPrice !== Math.min(...priceArray)) {
            await prisma.items.update({
                where: {
                    itemId: Number(id)
                },
                data: {
                    minPrice: Math.min(...priceArray)
                }
            })
        }

        item = await verifyDetailId(id, style)

        item.styles = await prisma.item_details.findMany({
            where: {
                itemId: Number(id),
                style: style
            }
        })

        // return converter of product
        return res.json(productConverter(item))
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

// DELETE - delete sku product
router.delete('/:id/:style', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    try {
        // find item id
        let item = await verifyDetailId(validateInt("itemId", Number(req.params.id)), req.params.style)
        let all_item_sku = await prisma.item_sku.count({
            where: {
                itemId: Number(req.params.id)
            }
        })

        // check if supplier role update other username
        if (req.user.role == ROLE.Supplier && item.itemOwner !== req.user.username)
            forbiddenError("This supplier can delete owner's item only")

        if (all_item_sku <= 1) {
            forbiddenError("The product must have at least 1 sku")
        }

        // find id to delete product
        let input = await prisma.item_sku.delete({
            where: {
                itemId_SKUstyle: {
                    itemId: Number(req.params.id),
                    SKUstyle: req.params.style
                }
            }
        })
        return res.json({ message: "item id " + req.params.id + " with sku style " + req.params.style + " has been deleted" })
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

// DELETE - delete product
router.delete('/:id', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    try {
        // find item id
        let item = await verifyId(validateInt("validate itemId", req.params.id))

        // check if supplier role update other username
        if (req.user.role == ROLE.Supplier && item.itemOwner !== req.user.username)
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
            console.log(err.code)
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "item id " + req.params.id + " does not exist"
            } else if (err.code) {
                err.message = "item id " + req.params.id + " cannot delete when user who had already paid order or reviewed"
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
            // where: {
            //     rating: {
            //         gte: 3,
            //         lte: 5
            //     },
            // },
            select: reviewView,
            orderBy: { createdAt: "desc" }
        })

        let avg_rating = await prisma.item_reviews.aggregate({
            _avg: {
                PQrating: true,
                SSrating: true,
                DSrating: true
            },
        })

        // return to page with page number and page size
        let page_rv = paginationList(filter_rv, pageN, limitN, 10)
        // return average review
        page_rv.avg_rating = (avg_rating._avg.PQrating + avg_rating._avg.SSrating + avg_rating._avg.DSrating) / 3
        // console.log(page_rv.list)
        page_rv.list = await Promise.all(page_rv.list.map(async rv => {
            // Replace this with the IANA timezone you desire
            rv.time = getDifferentTime(rv.createdAt)
            rv.createdAt = undefined
            rv.rating = (rv.PQrating + rv.SSrating + rv.DSrating) / 3
            rv.PQrating = undefined
            rv.SSrating = undefined
            rv.DSrating = undefined
            return rv
        }))

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
        let item_reviews = await findAllReviewByItemId(validateInt("validate itemId", req.params.prodId), sort, style)

        // review item with pagination
        item_reviews = paginationList(item_reviews, pageN, limitN, 5)

        // Promise.all(
        //     // change time zone and icon
        //     item_reviews.list.length === 0 ? [] :
        //         item_reviews.list.map(review => {
        //             // Replace this with the IANA timezone you desire
        //             review.time = getDifferentTime(review.createdAt)
        //             review.createdAt = undefined
        //             review.size = review.size == "No" ? undefined : review.size
        //             return getIconImage(deleteNullValue(review))
        //         })
        // ).then(data => {
        //     // console.log(data)
        //     item_reviews.list = data
        //     // console.log(item_reviews.list)
        //     return res.send(item_reviews)
        // })
        // .catch(err => {
        //     next(err)
        // })

        let updatedReviews = [];

        for (let review of item_reviews.list) {
            // Replace this with the IANA timezone you desire
            // review.time = getDifferentTime(review.createdAt);
            // review.createdAt = undefined;
            review.rating = (review.PQrating + review.SSrating + review.DSrating) / 3
            review.PQrating = undefined
            review.SSrating = undefined
            review.DSrating = undefined
            let like = false
            if (req.user) {
                let reviewLike = await prisma.item_review_likes.findFirst({
                    where: {
                        AND: [
                            { username: req.user.username },
                            { itemReviewId: review.itemReviewId }
                        ]
                    }
                })
                if (reviewLike !== null) {
                    like = true
                }
            }
            review.isLike = like
            review.images = await getReviewImage(review.itemReviewId)
            let user = await prisma.accounts.findFirst({
                where: {
                    username: review.username
                }
            })
            review.userId = user.userId
            updatedReviews.push(await getIconImage(reviewConvertor(review)));
        }

        item_reviews.list = updatedReviews;
        res.send(item_reviews);
    } catch (err) {
        next(err)
    }
})

// GET - get review in product id and review id
router.get('/:prodId/reviews/:reviewId', JwtAuth, async (req, res, next) => {
    try {
        // find item id
        let review = await findReviewById(validateInt("validate itemId", req.params.prodId), validateStr("validate reviewId", req.params.reviewId, 53))

        if (req.user.username !== review.username) forbiddenError("This user can see your review detail only")

        review.rating = (review.PQrating + review.SSrating + review.DSrating) / 3

        let item = await prisma.items.findFirst({ where: { itemId: review.itemId } })
        review.itemname = item.name
        review.images = await getReviewImage(review.itemReviewId)
        review = await reviewConvertor(review);
        return res.send(review);
    } catch (err) {
        next(err)
    }
})

// GET - get review in product id and order id
router.get('/review_orders/:orderId/:productId/:itemStyle/:itemSize', JwtAuth, async (req, res, next) => {
    try {
        let { orderId, productId, itemStyle, itemSize } = req.params

        // find item id
        let item_review = await findReviewByOrderId(
            validateStr("validate orderId", orderId, 53),
            validateInt("validate productId", Number(productId)),
            validateStr("validate style", itemStyle, 20),
            validateStr("validate size", itemSize, 50)
        )
        // console.log(item_reviews)

        if (req.user.username !== item_review.username) forbiddenError("This user can see your review in your order only")
        // console.log(item_reviews)
        item_review.username = undefined;
        item_review.like = undefined

        return res.send(reviewConvertor(item_review));
    } catch (err) {
        next(err)
    }
})

// POST - add reviews into product id
router.post('/:prodId/reviews', JwtAuth, async (req, res, next) => {
    try {
        let { itemReviewId, comment, PQrating, SSrating, DSrating, style, size, orderId } = req.body

        // find item id
        let item = await verifyId(validateInt("validate itemId", req.params.prodId))
        let order = await verifyOrderDetailId(orderId, item.itemId, style, size)
        let itemReview = await prisma.item_reviews.findMany({
            where: {
                AND: [
                    { itemId: item.itemId },
                    { style: style },
                    { size: size },
                    { orderId: orderId }
                ]
            }
        })
        // console.log(itemReview)

        if (itemReview.length !== 0) validatError("This order has already reviewed")

        // // check size
        // if (!item.styles[0].size.includes(size)) notFoundError(`item id ${item.itemId} size not found `)

        // generate id
        const id = generateIdByMapping(16, req.user.username)

        // console.log(id.length); // => f9b327e70bbcf42494ccb28b2d98e00e

        // console.log(itemReviewId)

        // add this user for comment
        let review = await prisma.item_reviews.create({
            data: {
                itemReviewId: itemReviewId !== undefined ? itemReviewId : id,
                itemId: item.itemId,
                username: req.user.username,
                comment: validateStr("review comment", comment, 500),
                PQrating: validateInt("review product quanlity rating", PQrating, false, 1, 5),
                SSrating: validateInt("review seller service rating", SSrating, false, 1, 5),
                DSrating: validateInt("review delivery service rating", DSrating, false, 1, 5),
                size: validateStr("item size", size, 50),
                style: validateStr("item style", style, 20),
                orderId: orderId
            }
        })

        // change status of order rating date
        await prisma.orders.update({
            data: {
                rateOrderDate: addHours(new Date(), 7)
            },
            where: {
                orderId: order.orderId
            }
        })

        // change average of rating in this item
        await changeTotalRating(item.itemId)

        return res.status(201).json(reviewConvertor(review))
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
        let review = await findReviewById(validateInt("validate itemId", prodId), commentId)

        // check item owner can delete review only
        if (req.user.role !== ROLE.Supplier && review.username !== req.user.username) forbiddenError("supplier can update your item owner review only")

        // find id to delete product
        await prisma.item_reviews.delete({
            where: {
                itemReviewId: commentId
            }
        })

        // change average of rating in this item
        await changeTotalRating(review.itemId)

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

// PUT - edit reviewed item in each order
router.patch('/:prodId/reviews/:commentId', JwtAuth, async (req, res, next) => {
    try {
        let { prodId, commentId } = req.params

        // find item id
        let review = await findReviewById(validateInt("validate itemId", prodId), commentId)

        // check item owner can update review only
        if (req.user.role !== ROLE.Supplier && review.username !== req.user.username) forbiddenError("user can update your item review only")

        let mapData = {}
        // body params mapping
        for (let i in req.body) {
            if (req.body[i] != undefined) {
                // map object from body when update in prisma model
                mapData[i] =
                    i == "comment" ? validateStr("item review", req.body[i], 500) :
                        i == "PQrating" ? validateInt("item review product quanlity rating", req.body[i], false, 1, 5) :
                            i == "SSrating" ? validateInt("item review selling service rating", req.body[i], false, 1, 5) :
                                i == "DSrating" ? validateInt("item review delivery service rating", req.body[i], false, 1, 5) : undefined // unused body request
            }
        }

        // find id to update product
        await prisma.item_reviews.update({
            data: mapData,
            where: {
                itemReviewId: commentId
            }
        })

        // change average of rating in this item
        await changeTotalRating(review.itemId)

        return res.json({ message: "item review id " + commentId + " has been updated" })
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
        let review = await findReviewById(validateInt("validate itemId", prodId), commentId)
        let like = await findReviewLike(req.user.username, commentId)

        let comment
        // check if review is undefined
        if (like === null) {
            // add like message on log
            let input = await prisma.item_review_likes.create({
                data: {
                    itemReviewId: commentId,
                    username: req.user.username
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
                    itemReviewId_username: {
                        itemReviewId: commentId,
                        username: req.user.username
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

// ---------------------------------------------- method zone ----------------------------------------------------------------

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

const getProductImage = async (product) => {
    product.image = await listFirstImage(findImagePath("products", product.itemId), "main.png")
    // console.log(product.image)
    return product
}

const getProductStyleImage = async (style, id) => {
    return await listAllImage(findImagePath("products", id + '/' + style))
}

const getReviewImage = async (id) => {
    return await listAllImage(findImagePath("reviews", id))
}

const getIconImage = async (user) => {
    user.image = await listFirstImage(findImagePath("users", user.userId), "main.png")
    // console.log(user.image)
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
const verifyDetailId = async (id, sty, size) => {

    let item_detail = []
    if (size !== undefined) {
        // find product by id
        item_detail = await prisma.item_details.findFirst({
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
        return item
    } else {
        // find product by id
        item_detail = await prisma.item_sku.findFirst({
            where: {
                AND: [
                    { itemId: Number(id) },
                    { SKUstyle: sty }
                ]
            },
            include: {
                item_details: true
            }
        })

        // check that product is found
        if (item_detail === null) notFoundError("item id " + id + " in style " + sty + " does not exist")

        // check that item owner
        let item = await prisma.items.findFirst({
            where: { itemId: Number(id) }
        })

        // return converter of product
        return item
    }
}

const verifyOrderDetailId = async (orderId, itemId, itemStyle, itemSize) => {
    // find user by account username
    let order = await prisma.order_details.findFirst({
        where: {
            AND: [
                { orderId: orderId },
                { itemId: itemId },
                { itemStyle: itemStyle },
                { itemSize: itemSize }
            ]
        }
    })
    // check user exist
    if (order == null) notFoundError("your order " + orderId + " with detail of item id " + itemId + " sku style " + itemStyle + " and size " + itemSize + " does not exist")
    return order
}

const verifyUsername = async (username) => {
    // find user by account username
    let filter_user = await prisma.accounts.findFirst({
        select: userViewFav(),
        where: {
            username: username
        }
    })

    // check user exist
    if (filter_user == null) notFoundError("user name " + username + " does not exist")

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

    // console.log(name)

    // get review by itemReview, item id and username
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

    return review
}

const changeTotalRating = async (id) => {
    // get average value of rating in item id
    let avg_review = await prisma.item_reviews.aggregate({
        _avg: {
            PQrating: true,
            SSrating: true,
            DSrating: true
        },
        where: {
            itemId: id
        }
    })

    // update average rating in item id
    await prisma.items.update({
        data: {
            totalRating: (avg_review._avg.PQrating + avg_review._avg.SSrating + avg_review._avg.DSrating) / 3
        },
        where: {
            itemId: id
        }
    })
    return avg_review
}

const findReviewById = async (prodId, commendId) => {
    // get review by itemReview, item id and username
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

const findReviewByOrderId = async (orderId, itemId, itemStyle, itemSize) => {
    // get review by itemReview, item id and username
    let review = await prisma.item_reviews.findFirst({
        where: {
            AND: [
                { orderId: orderId },
                { itemId: itemId },
                { style: itemStyle },
                { size: itemSize }
            ]
        },
        select: reviewViewOrder
    })

    // check that product is found
    if (review === null) notFoundError("item with order id " + orderId + " does not exist")

    return review
}


const findReviewLike = async (username, commendId) => {
    // get review by itemReview, item id and username
    let like = await prisma.item_review_likes.findFirst({
        where: {
            AND: [
                { itemReviewId: commendId },
                { username: username }
            ]
        }
    })

    return like
}


const findFavPdById = async (username, id) => {
    // find product that match to username
    let fav_pd = await prisma.favprd.findFirst({
        where: {
            AND: [
                { itemId: Number(id) },
                { username: username }
            ]
        }
    })
    return fav_pd
}

const haveItemSoles = async (product) => {
    let orders = await prisma.orders.findMany({
        where: {
            status: ORDERSTATUS.COMPLETED
        },
        select: {
            order_details: {
                where: {
                    itemId: product.itemId
                }
            }
        }
    })
    product.sold = orders.reduce((cur, pre) => {
        return cur + pre.order_details.reduce((cur1, pre1) => cur1 + pre1.qtyOrder, 0)
    }, 0)
    return product
}

const haveItemSolesIn2Month = async (product) => {
    let orders = await prisma.orders.findMany({
        where: {
            AND: [
                { status: ORDERSTATUS.COMPLETED },
                {
                    createdAt: {
                        gte: new Date(Date.now().valueOf() - 60 * 24 * 60 * 60 * 1000)
                    }
                }
            ]
        },
        select: {
            order_details: {
                where: {
                    itemId: product.itemId
                }
            }
        }
    })
    // console.log(orders)
    product.sold = orders.reduce((cur, pre) => {
        return cur + pre.order_details.reduce((cur1, pre1) => cur1 + pre1.qtyOrder, 0)
    }, 0)
    return product
}

module.exports = router