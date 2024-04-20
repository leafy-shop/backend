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
    username: true,
    comment: true,
    PQrating: true,
    SSrating: true,
    DSrating: true,
    createdAt: true
}

const reviewViewOwner = {
    itemReviewId: true,
    itemId: true,
    username: true,
    comment: true,
    PQrating: true,
    SSrating: true,
    DSrating: true,
    like: true,
    style: true,
    size: true,
    createdAt: true
}

const reviewViewOrder = {
    itemReviewId: true,
    itemId: true,
    username: true,
    comment: true,
    PQrating: true,
    SSrating: true,
    DSrating: true,
    createdAt: true
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


let orderView = {
    orderId: true,
    orderGroupId: true,
    customerName: true,
    status: true,
    createdAt: true,
    address: true,
    order_details: {
        select: {
            itemStyle: true,
            itemSize: true,
            itemId: true,
            qtyOrder: true,
            priceEach: true
        }
    }
}

let orderDetailView = {
    orderId: true,
    customerName: true,
    status: true,
    createdAt: true,
    paidOrderDate: true,
    shippedOrderDate: true,
    receivedOrderDate: true,
    rateOrderDate: true,
    address: true,
    order_details: {
        select: {
            itemStyle: true,
            itemSize: true,
            itemId: true,
            qtyOrder: true,
            priceEach: true
        }
    }
}

module.exports.userView = userView
module.exports.userDetailView = userDetailView
module.exports.gardenDesignerView = gardenDesignerView
module.exports.reviewView = reviewView
module.exports.userViewFav = userViewFav
module.exports.prodList = prodList
module.exports.supplierView = supplierView
module.exports.reviewViewOwner = reviewViewOwner
module.exports.orderView = orderView
module.exports.orderDetailView = orderDetailView
module.exports.reviewViewOrder = reviewViewOrder