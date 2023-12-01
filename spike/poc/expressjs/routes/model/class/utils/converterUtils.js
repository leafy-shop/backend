const { dateTimeZoneNow } = require("./datetimeUtils");
const { listFirstImage, findImagePath } = require("./imageList");
const { modelMapper } = require("./modelMapping");

let timeConverter = (value) => {
  // console.log(value)
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

  if (product.item_preview !== undefined) product.item_preview = product.item_preview.map(preview => timeConverter(preview))

  // time converter
  product = timeConverter(product)

  return product
}

const userConverter = (user) => {
  // date of birth converter
  // if (user.dob !== undefined) user.dob = dateTimeZoneNow(user.dob)

  // phone format
  if (user.phone !== undefined) user.phone = reformatPhoneNumber(user.phone)

  // time converter
  user = timeConverter(user)

  return user
}

const reformatPhoneNumber = (phoneNumber) => {
  if (phoneNumber.length === 10) {
    // Format for 0900000000 to 090-000-0000
    return phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  } else if (phoneNumber.length === 11) {
    // Format for 09000000000 to 090-000-0000-0
    return phoneNumber.replace(/(\d{3})(\d{3})(\d{4})(\d{1})/, '$1-$2-$3-$4');
  } else {
    // Return original number if it doesn't match expected lengths
    return phoneNumber;
  }
}

const paginationList = (list, pageN, limitN, maxLimit) => {
  // return to page with page number and page size

  // set corrected page
  let varPage = (pageN <= 1 || isNaN(pageN)) ? 1 : pageN

  // set page size
  let varLimit = (limitN <= 0 || isNaN(limitN) || limitN >= maxLimit) ? maxLimit : limitN

  // set current page
  let currentPage = (varPage - 1) * varLimit

  // create page template for return value
  let pageTemplate = {
    "page": varPage, "pageSize": varLimit,
    "AllPage": Math.ceil(list.length / varLimit),
    "AllItems": list.length,
    data: list.slice(currentPage, currentPage + varLimit)
  }
  return pageTemplate
}

module.exports.productConverter = productConverter
module.exports.timeConverter = timeConverter
module.exports.userConverter = userConverter
module.exports.paginationList = paginationList