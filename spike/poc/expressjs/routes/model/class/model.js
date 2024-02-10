const prodList = {
    itemId: true,
    name: true,
    itemOwner: true,
    type: true,
    totalRating: true,
    sold: true,
    minPrice: true,
    maxPrice: true,
    updatedAt: true
}

const userView = {
    userId: true,
    username: true,
    email: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true
}

const gardenDesignerView = {
    userId: true,
    username: true,
    description: true,
    createdAt: true,
    updatedAt: true
}

const reviewView = {
    itemReviewId: true,
    accounts: {
        select: {
            username: true
        }
    },
    comment: true,
    rating: true,
    createdAt: true
}

const reviewViewOwner = {
    itemReviewId: true,
    accounts: {
        select: {
            userId: true,
            username: true
        }
    },
    comment: true,
    rating: true,
    like: true,
    style: true,
    size: true,
    createdAt: true
    // "itemReviewId": "279396e6232f8e9748dab8815aec90c0",
    // "itemId": 8,
    // "userEmail": "sahatat44@gmail.com",
    // "comment": "Test Okay",
    // "rating": 4,
    // "like": 0,
    // "style": "light purple flower",
    // "size": "No",
    // "time": "1 month ago"
}

const userDetailView = {
    userId: true,
    username: true,
    firstname: true,
    lastname: true,
    description: true,
    email: true,
    role: true,
    status: true,
    phone: true,
    createdAt: true,
    updatedAt: true
}

const supplierView = {
    userId: true,
    username: true,
    firstname: true,
    lastname: true,
    email: true,
    role: true,
    createdAt: true,
}

const userViewFav = () => {
    let userViewPrd = new Object(userView)
    userViewPrd.favprd = {
        select: {
            items: {
                select: prodList
            }
        }
    }
    return userView
}

module.exports.userView = userView
module.exports.userDetailView = userDetailView
module.exports.gardenDesignerView = gardenDesignerView
module.exports.reviewView = reviewView
module.exports.userViewFav = userViewFav
module.exports.prodList = prodList
module.exports.supplierView = supplierView
module.exports.reviewViewOwner = reviewViewOwner