const express = require('express');
const router = express.Router();

const { validateStr, validateInt } = require('../../validation/body')
const { notFoundError, forbiddenError } = require('../../model/error/error')
const { commentViewOwner } = require('../../model/class/model')
const { JwtAuth, verifyRole, UnstrictJwtAuth } = require('../../../middleware/jwtAuth')

const { PrismaClient, Prisma } = require('@prisma/client');
const { contentConverter, paginationList, generateIdByMapping, timeConverter } = require('../../model/class/utils/converterUtils');
const { ROLE } = require('../../model/enum/role');
const { findImagePath, listFirstImage, listAllImage } = require('../../model/class/utils/imageList');
const prisma = new PrismaClient()

const dotenv = require('dotenv');

// get config vars
dotenv.config();

// content demo
// const content_db = [
//     {
//         "name": "Test garden",
//         "description": "this is testing garden",
//         "style": "Test"
//     },
//     {
//         "name": "Japanese garden",
//         "description": "this is testing garden",
//         "style": "Japanese"
//     }

// GET - all page contents by filter and sort
router.get('/', UnstrictJwtAuth, async (req, res, next) => {
    // query params
    let { page, limit, style, sort_name, sort, content_owner } = req.query

    // page number and page size
    let pageN = Number(page)
    let limitN = Number(limit)
    // console.log(limit)

    // customize sorting model
    let sortModel = {}
    if (sort_name == "latest") {
        sortModel.createdAt = (sort === "desc") ? "desc" : "asc"
    }
    else if (sort_name == "popular") {
        sortModel.like = (sort === "desc") ? "desc" : "asc"
    }
    else {
        sortModel.updatedAt = "desc"
    }

    // filter single and between value from style query and return page that sorted by updateAt content
    try {
        let filter_pd = await prisma.contents.findMany({
            where: {
                AND: [
                    { style: style },
                    { contentOwner: content_owner }
                ]

            },
            orderBy: sortModel
        })

        // Paginate the filtered content list
        const page_ct = paginationList(filter_pd, pageN, limitN, 20);

        // Fetch images for content list
        const contentList = await Promise.all(page_ct.list.map(async (content) => {
            
            let like = false
            if (req.user) {
                let ContentLike = await prisma.content_likes.findFirst({
                    where: {
                        AND: [
                            { username: req.user.username },
                            { contentId: content.contentId }
                        ]
                    }
                })
                if (ContentLike !== null) {
                    like = true
                }
            }
            content.isLike = like

            let comment = await prisma.gallery_comments.count({
                where: {
                    contentId: content.contentId
                }
            })
            content.comment = comment

            let user = await prisma.accounts.findFirst({
                where: {
                    username: content.contentOwner
                }
            })
            content.userId = user.userId
            content.icon = await listFirstImage(findImagePath("users", user.userId), "main.png")
            return await getContentImage(contentConverter(content));
        }));

        page_ct.list = contentList

        return res.send(page_ct);

    } catch (err) {
        next(err)
    }
})

router.get('/owner', JwtAuth, async (req, res, next) => {
    // query params
    let { page, limit, style, sort_name, sort } = req.query

    // page number and page size
    let pageN = Number(page)
    let limitN = Number(limit)
    // console.log(limit)

    // customize sorting model
    let sortModel = {}
    if (sort_name == "latest") {
        sortModel.createdAt = (sort === "desc") ? "desc" : "asc"
    }
    else if (sort_name == "popular") {
        sortModel.like = (sort === "desc") ? "desc" : "asc"
    }
    else {
        sortModel.updatedAt = "desc"
    }

    // filter single and between value from style query and return page that sorted by updateAt content
    try {
        let filter_pd = await prisma.contents.findMany({
            where: {
                AND: [
                    { style: style },
                    { contentOwner: req.user.username }
                ]

            },
            include: {
                favprd: false,
            },
            orderBy: sortModel
        })

        // Paginate the filtered content list
        const page_ct = paginationList(filter_pd, pageN, limitN, 20);

        // Fetch images for content list
        const contentList = await Promise.all(page_ct.list.map(async (content) => {
            let comment = await prisma.gallery_comments.count({
                where: {
                    contentId: content.contentId
                }
            })
            content.comment = comment
            return await getContentImage(contentConverter(content));
        }));

        page_ct.list = contentList

        return res.send(page_ct);

    } catch (err) {
        next(err)
    }
})

// GET - contents by id
router.get('/:id', UnstrictJwtAuth, async (req, res, next) => {
    try {
        // find id of content
        let content = await verifyId(validateInt("validate contentId", req.params.id))
        
        let path = findImagePath("contents", content.contentId)
        content.image = await listFirstImage(path, "main.png")
        content.images = await getContentDetailImage(content.contentId)

        let comment = await prisma.gallery_comments.count({
            where: {
                contentId: content.contentId
            }
        })
        content.comment = comment

        let user = await prisma.accounts.findFirst({
            where: {
                username: content.contentOwner
            }
        })
        content.userId = user.userId
        content.icon = await listFirstImage(findImagePath("users", user.userId), "main.png")
        
        // Respond with the updated content object
        return res.json(contentConverter(content));
    } catch (err) {
        next(err)
    }
})

// POST - create content and content details
router.post('/', JwtAuth, async (req, res, next) => {
    let { contentId, name, description, style, contentOwner } = req.body

    // created content from request body and validation
    try {
        let contentModel = {
            contentId: isNaN(contentId) ? undefined : validateInt("content id", contentId, true),
            name: validateStr("content name", name, 100),
            description: validateStr("content description", description, 5000, true),
            style: validateStr("content style", style, 50)
        }

        if (req.user.role == ROLE.Admin) {
            contentModel.contentOwner = validateStr("content owner", contentOwner, 20)
        } else {
            contentModel.contentOwner = req.user.username
        }

        // console.log(contentModel)

        // create content with username owner
        let input = await prisma.contents.create({
            data: contentModel
        })

        return res.status(201).json(contentConverter(input));

    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.meta.target === 'PRIMARY') {
                err.message = "content of user is duplicated"
            }
        }
        next(err)
    }
})

// PATCH - update content by id
router.patch('/:id', JwtAuth, async (req, res, next) => {
    let mapData = {}

    // update content
    try {
        // find content id
        let content = await verifyId(validateInt("validate contentId", req.params.id))

        // check if supplier role update other username
        if (req.user.role !== ROLE.Admin && content.contentOwner !== req.user.username)
            forbiddenError("This user can update owner's content only")

        // body params mapping
        for (let i in req.body) {
            if (req.body[i] != undefined) {
                // map object from body when update in prisma model
                mapData[i] =
                    i == "name" ? validateStr("content name", req.body[i], 100) :
                        i == "description" ? validateStr("content description", req.body[i], 5000, true) :
                            i == "style" ? validateStr("content style", req.body[i], 20) : undefined // unused body request
            }
        }

        let input = await prisma.contents.update({
            where: {
                contentId: Number(req.params.id)
            },
            data: mapData
        })
        // return update content converter
        return res.json(contentConverter(input))
    } catch (err) {
        // if content is not found
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "content id " + req.params.id + " does not exist"
            }
        }
        next(err)
    }
})

// PUT - like content by content id
router.put('/:contentId/like', JwtAuth, async (req, res, next) => {
    try {
        let { contentId } = req.params

        // get average value of rating in content id
        let content = await verifyId(validateInt("validate contentId", contentId))

        // check if supplier role update other username
        if (content.contentOwner === req.user.username)
            forbiddenError("This user cannot like owner's content only")

        // check like user
        let like = await findCommentLike(req.user.username, content.contentId)

        // check if comment is undefined
        if (like === null) {
            // add like message on log
            let input = await prisma.content_likes.create({
                data: {
                    contentId: content.contentId,
                    username: req.user.username
                }
            })

            // update like in content id
            content = await prisma.contents.update({
                data: {
                    like: {
                        increment: 1
                    }
                },
                where: {
                    contentId: content.contentId
                }
            })
        } else {
            // revert like message on log
            await prisma.content_likes.delete({
                where: {
                    contentId_username: {
                        contentId: content.contentId,
                        username: req.user.username
                    }
                }
            })

            // update unlike in content id
            content = await prisma.contents.update({
                data: {
                    like: {
                        decrement: 1
                    }
                },
                where: {
                    contentId: content.contentId
                }
            })
        }

        return res.json(contentConverter(content))
    } catch (err) {
        // if content is not found
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "content comment id " + req.params.commentId + " does not exist"
            }
        }
        next(err)
    }
})

// DELETE - delete content
router.delete('/:id', JwtAuth, async (req, res, next) => {
    try {
        // find content id
        let content = await verifyId(validateInt("validate contentId", req.params.id))

        // check if supplier role update other username
        if (req.user.role !== ROLE.Supplier && content.contentOwner !== req.user.username)
            forbiddenError("This user can delete owner's content only")

        // find id to delete content
        let input = await prisma.contents.delete({
            where: {
                contentId: validateInt("contentId", Number(req.params.id)),
            }
        })
        return res.json({ message: "content id " + req.params.id + " has been deleted" })
    } catch (err) {
        // if content is not found
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            console.log(err.code)
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "content id " + req.params.id + " does not exist"
            }
        }
        next(err)
    }
})

// -------------------------------------------------------- comment  zone ---------------------------------------------------------

// GET - get all comment in content id
router.get('/:contentId/comments', UnstrictJwtAuth, async (req, res, next) => {
    try {
        // query params
        let { page, limit, sort } = req.query

        // page number and page size
        let pageN = Number(page)
        let limitN = Number(limit)

        // find content id
        let content_comments = await findAllCommentByContentId(validateInt("validate contentId", req.params.contentId), sort)

        // comment content with pagination
        pg_comment = paginationList(content_comments, pageN, limitN, 5)

        // Fetch images for content list
        const commentList = await Promise.all(pg_comment.list.map(async (comment) => {
            let user = await prisma.accounts.findFirst({
                where: {username: comment.username}
            })
            comment.userId = user.userId
            return await getIconImage(contentConverter(comment));
        }));
        console.log(commentList)

        pg_comment.list = commentList

        return res.send(pg_comment);
    } catch (err) {
        next(err)
    }
})

// POST - add comments into content id
router.post('/:contentId/comments', JwtAuth, async (req, res, next) => {
    try {
        let { commentId, comment } = req.body

        // find content id
        let content = await verifyId(validateInt("validate contentId", req.params.contentId))

        // generate id
        const id = generateIdByMapping(16, req.user.username)

        // add this user for comment
        let input = await prisma.gallery_comments.create({
            data: {
                commentId: commentId !== undefined ? commentId : id,
                contentId: content.contentId,
                username: req.user.username,
                comment: validateStr("comment comment", comment, 500)
            }
        })

        return res.status(201).json(timeConverter(input))
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2002') {
                err.message = "content comment is duplicated"
            }
            if (err.code === 'P2025') {
                err.message = "content id " + req.params.contentId + " does not exist"
            }
        }
        next(err)
    }
})

// DELETE - delete comment by comment id and content id
router.delete('/:contentId/comments/:commentId', JwtAuth, async (req, res, next) => {
    try {
        let { contentId, commentId } = req.params

        // find content id
        let content = await findCommentById(validateInt("validate contentId", contentId), commentId)

        // check content owner can delete comment only
        if (content.username !== req.user.username) forbiddenError("user can delete your content owner comment only")

        // find id to delete content
        await prisma.gallery_comments.delete({
            where: {
                commentId: commentId
            }
        })

        return res.json({ message: "content comment id " + commentId + " has been deleted" })
    } catch (err) {
        // if content is not found
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            // The .code property can be accessed in a type-safe manner
            if (err.code === 'P2025') {
                err.message = "content comment id " + req.params.commentId + " does not exist"
            }
        }
        next(err)
    }
})

// ---------------------------------------------- method zone ----------------------------------------------------------------
const getContentImage = async (content) => {
    content.image = await listFirstImage(findImagePath("contents", content.contentId), "main.png")
    // console.log(content.image)
    return content
}

const getContentDetailImage = async (id) => {
    return await listAllImage(findImagePath("contents", id + '/details'))
}

const getIconImage = async (content) => {
    content.image = await listFirstImage(findImagePath("users", content.userId), "main.png")
    // console.log(user)
    return content
}

const verifyId = async (id) => {
    // find content by id
    let content = await prisma.contents.findFirst({
        where: {
            contentId: Number(id)
        }
    })

    // check that content is found
    if (content == null) notFoundError("content id " + id + " does not exist")

    return content
}


const findAllCommentByContentId = async (contentId, sort) => {
    let sortModel = (sort === 'newest' ? { createdAt: 'desc' } : sort === 'oldest' ? { createdAt: 'asc' } : undefined)

    // get comment by contentComment, content id and username
    let comments = await prisma.gallery_comments.findMany({
        where: {
            contentId: Number(contentId)
        },
        orderBy: sortModel
    })

    // check that content is found
    if (comments == null) notFoundError("content id " + contentId + " does not exist")

    return comments
}

const findCommentById = async (contentId, commendId) => {
    // get comment by contentComment, content id and username
    let comment = await prisma.gallery_comments.findFirst({
        where: {
            AND: [
                { commentId: commendId },
                { contentId: Number(contentId) },
            ]
        }
    })

    // check that content is found
    if (comment == null) notFoundError("content comment id " + commendId + " does not exist")

    return comment
}

const findCommentLike = async (username, contentId) => {
    // get comment by contentComment, content id and username
    let like = await prisma.content_likes.findFirst({
        where: {
            AND: [
                { contentId: contentId },
                { username: username }
            ]
        }
    })

    return like
}

module.exports = router