const express = require('express');
const router = express.Router();

const { validateStr, validateInt, validateDouble, validateEmail, validateStrArray } = require('../validation/body')
const { notFoundError, forbiddenError } = require('./../model/error/error')
// const { dateTimeZoneNow } = require('../model/class/utils/datetimeUtils')
const { userViewFav, prodList, reviewView } = require('./../model/class/model')
const { JwtAuth, verifyRole, UnstrictJwtAuth } = require('./../../middleware/jwtAuth')

const { PrismaClient, Prisma } = require('@prisma/client');
// const { deleteNullValue } = require('../model/class/utils/modelMapping');
// const { mode } = require('../../config/minio_config');
const { productConverter, timeConverter, paginationList, generateId } = require('../model/class/utils/converterUtils');
const { ROLE } = require('../model/enum/role');
const { findImagePath, listFirstImage, getAllStyleImageItem } = require('../model/class/utils/imageList');
const prisma = new PrismaClient()
// const crypto = require("crypto");
// const { DateTime } = require("luxon");
const { getDifferentTime } = require('../model/class/utils/datetimeUtils');

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
        sort_name, sort } = req.query

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
    if (sort_name !== undefined && ["price", "sold", "updatedAt", "totalRating"].includes(sort_name)) {
        sortModel[sort_name] = (sort === "desc") ? "desc" : "asc"
    } else {
        sortModel.updatedAt = "desc"
    }

    // rating scale format for filter
    let ratingScale = [[0.9, 1.8], [1.8, 2.6], [2.6, 3.4], [3.4, 4.2], [4.2, 5]]

    // console.log(rating)
    // console.log(isNaN(rating) ? undefined : ratingScale[rating - 1][0])
    // console.log(isNaN(rating) ? undefined : ratingScale[rating - 1][1])

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

        // filter includes array : complexity best case O(n), worst case O(n*(type+tag))
        filter_pd = filter_pd.filter(product => {
            condition = (type === undefined ? true : type.split(",").includes(product.type)) &&
                (tag === undefined ? true : product.tag.split(",").includes(tag))
            // (tag === undefined ? true : tag.split(",").some(r => product.tag.split(",").includes(r)))
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

        // check if user is supplier then see only owner product
        if (req.user !== undefined && req.user.role === ROLE.Supplier) filter_pd = filter_pd.filter(product => product.itemOwner == req.user.email)

        // return to page with page number and page size
        page_pd = paginationList(filter_pd, pageN, limitN, 18)

        // array converter and image mapping
        Promise.all(
            // list product with image
            page_pd.list.length === 0 ? [] :
                page_pd.list.map(product => getProductImage(productConverter(product, prodList)))
            // filter_pd.map(product => productConverter(product, prodList))
        ).then(productList => {
            page_pd.list = productList
            return res.send(page_pd)
        }).catch(err => {
            next(err)
        })
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

router.get('/:id', UnstrictJwtAuth, async (req, res, next) => {
    try {
        // find id of product
        let item = await verifyId(req.params.id)

        // check user is supplier
        if (req.user !== undefined && req.user.role === ROLE.Supplier && item.itemOwner !== req.user.email)
            forbiddenError("This supplier can view owner's item only")

        // image for product
        let path = findImagePath("products", item.itemId)
        item.image = await listFirstImage(path)


        // list product review to page
        page = Number(req.query.rv_page)
        limit = Number(req.query.rv_limit)
        item.item_reviews = paginationList(item.item_reviews, page, limit, 5)

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
            return res.json(item)
        }).catch(err => {
            next(err)
        })
    } catch (err) {
        next(err)
    }
})

router.post('/', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    let { itemId, name, description, itemOwner, type, tag, size, styles, price } = req.body
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


        let itemModel = {
            itemId: isNaN(itemId) ? undefined : validateInt("item id", itemId, true),
            name: validateStr("item name", name, 100),
            description: validateStr("item description", description, 5000, true),
            type: validateStr("item type", type, 20),
            tag: validateStrArray("item tag", tag, 10, 20),
            price: validateDouble("item price", price, true)
        }
        if (req.user.role == ROLE.Admin) {
            itemModel.itemOwner = validateEmail("item owner", itemOwner, 100)

        }
        // create item with email owner
        let input = await prisma.items.create({
            data: itemModel
        })

        const item_detail = styles.map((sty) =>
            prisma.item_details.create({
                data: {
                    itemId: input.itemId,
                    style: validateStr("item style", sty.style, 50),
                    size: validateStrArray("item size", sty.size, 5, 4, true)
                }
            })
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
                            i == "price" ? validateDouble("item price", req.body[i], true) : undefined // unused body request
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

router.put('/:id/:style', JwtAuth, verifyRole(ROLE.Admin, ROLE.Supplier), async (req, res, next) => {
    // update product
    try {
        // find item id
        let item = await verifyDetailId(req.params.id, req.params.style)

        // check if supplier role update other email
        if (req.user.role == ROLE.Supplier && item.itemOwner !== req.user.email)
            forbiddenError("This supplier can update owner's item only")

        // check that product is found
        if (item == null) notFoundError("item id " + id + " does not exist")

        // switch out of stock or not
        let outStock = { isOutOfStock: true }
        if (item.styles[0].isOutOfStock) {
            outStock.isOutOfStock = false
        }

        // update stock
        let input = await prisma.item_details.update({
            where: {
                itemId_style: {
                    itemId: Number(req.params.id),
                    style: req.params.style
                }
            },
            data: outStock
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
            return rv
        })

        return res.send(page_rv)

    } catch (err) {
        next(err)
    }
})

router.post('/:prodId/review', JwtAuth, async (req, res, next) => {
    try {
        let { itemReviewId, comment, rating, style } = req.body

        // find item id
        let item = await verifyDetailId(req.params.prodId, style)

        // // check size
        // if (!item.styles[0].size.includes(size)) notFoundError(`item id ${item.itemId} size not found `)

        // generate id
        const id = generateId(16)

        console.log(id.length); // => f9b327e70bbcf42494ccb28b2d98e00e

        console.log(itemReviewId)

        // add this user for comment
        let review = await prisma.item_reviews.create({
            data: {
                itemReviewId: itemReviewId !== undefined ? itemReviewId : id,
                itemId: item.itemId,
                userEmail: req.user.email,
                comment: validateStr("item comment", comment, 200),
                rating: validateInt("item rating", rating, 500, 1, 5),
                // size: size,
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

router.delete('/:prodId/review/:commentId', JwtAuth, async (req, res, next) => {
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

router.put('/:prodId/review/:commentId/like', JwtAuth, async (req, res, next) => {
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
    product.image = await listFirstImage(findImagePath("products", product.itemId))
    return product
}

const getProductStyleImage = async (style) => {
    style.images = await getAllStyleImageItem(findImagePath("products", style.itemId + '/' + style.style))
    return style
}

const verifyId = async (id) => {
    // find product by id
    let item = await prisma.items.findFirst({
        where: {
            itemId: Number(id)
        },
        include: {
            item_reviews: {
                orderBy: {
                    createdAt: "desc"
                }
            }
        }
    })

    // check that product is found
    if (item == null) notFoundError("item id " + id + " does not exist")

    // find item_details and map to item
    item.styles = await prisma.item_details.findMany({
        where: {
            itemId: item.itemId
        }
    })

    // item.styles = await item.styles.map(async style => {
    //     style.image = await getAllStyleImageItem(findImagePath('products', style.itemId + "/" + style.style))
    //     console.log(style)
    //     return style
    // })

    // console.log(item.styles)
    return productConverter(item)
}

// use model for add to cart and check stock
const verifyDetailId = async (id, sty) => {
    // find product by id
    let item_detail = await prisma.item_details.findFirst({
        where: {
            AND: [
                { itemId: Number(id) },
                { style: sty }
            ]
        }
    })

    // check that product is found
    if (item_detail == null) notFoundError("item id " + id + " in style " + sty + " does not exist")

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