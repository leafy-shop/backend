const prodList = {
    itemId: true,
    name: true,
    itemOwner: true,
    type: true,
    tag: true,
    size: true,
    totalRating: true,
    sold: true,
    price: true,
    updatedAt: true
}

const userView = {
    userId: true,
    name: true,
    email: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true
}

const userViewFav = () => {
    userView["favprd"] = {
        select: {
            items: {
                select: prodList
            }
        }
    }
    return userView
}

module.exports.userView = userView
module.exports.userViewFav = userViewFav
module.exports.prodList = prodList