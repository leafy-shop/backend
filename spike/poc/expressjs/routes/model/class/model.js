const prodList = {
    itemId: true,
    name: true,
    itemOwner: true,
    type: true,
    totalRating: true,
    sold: true,
    price: true,
    updatedAt: true
}

const userView = {
    userId: true,
    // name: true,
    email: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true
}

const gardenDesignerView = {
    userId: true,
    firstname: true,
    lastname: true,
    description: true,
    createdAt: true,
    updatedAt: true
}

const reviewView = {
    itemReviewId: true,
    accounts: {
        select: {
            firstname: true,
            lastname: true
        }
    },
    comment: true,
    rating: true,
    createdAt: true
}

const userDetailView = {
    userId: true,
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