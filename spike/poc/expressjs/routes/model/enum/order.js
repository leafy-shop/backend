let ORDERSTATUS = Object.freeze({
    // supplier
    REQUIRED: "required",
    PENDING: "pending",
    INPROGRESS: "in progress",
    // driver
    // INTRANSIT: "in transit",
    // DELIVERED: "delivered",
    // customer
    COMPLETED: "completed",
    CANCELED: "canceled"
})

module.exports.ORDERSTATUS = ORDERSTATUS