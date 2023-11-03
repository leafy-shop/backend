const { dateTimeZoneNow } = require("./datetimeUtils");
const { modelMapper } = require("./modelMapping");

let timeConverter = (value) => {
    if (value.createdAt !== undefined) value.createdAt = dateTimeZoneNow(value.createdAt);
    if (value.updatedAt !== undefined) value.updatedAt = dateTimeZoneNow(value.updatedAt);
    return value
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

    // time converter
    product = timeConverter(product)
    
    return product
}

module.exports.productConverter = productConverter
module.exports.timeConverter = timeConverter