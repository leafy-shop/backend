const { dateTimeZoneNow } = require("./datetimeUtils");
// const { listFirstImage, findImagePath } = require("./imageList");
const { modelMapper, deleteNullValue } = require("./modelMapping");

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

  // delete null value
  product = deleteNullValue(product)

  // floating string to float convertor
  if (product.totalRating !== undefined) product.totalRating = parseFloat(product.totalRating)
  if (product.price !== undefined) product.price = parseFloat(product.price)

  // array converter
  if (product.tag !== undefined) product.tag = product.tag.split(",")
  
  // images converter
  if (product.images !== undefined) product.images = product.images.split(",")

  if (product.item_review !== undefined) product.item_review = product.item_review.map(review => timeConverter(review))

  // style converter
  if (product.styles !== undefined) product.styles = product.styles.map(style => {
    if (style.size !== undefined) style.size = style.size.split(",")
    return style
  })

  // time converter
  product = timeConverter(product)

  // delete null value
  return product
}

const userConverter = (user) => {
  // date of birth converter
  // if (user.dob !== undefined) user.dob = dateTimeZoneNow(user.dob)

  // delete null value
  user = deleteNullValue(user)

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
    "allPage": Math.ceil(list.length / varLimit),
    "allItems": list.length,
    // data: list.slice(currentPage, currentPage + varLimit)
    "list": list.slice(currentPage, currentPage + varLimit)
  }
  return pageTemplate
}

// reference: https://stackoverflow.com/questions/1026069/how-do-i-make-the-first-letter-of-a-string-uppercase-in-javascript?page=1&tab=scoredesc#tab-top
const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports.productConverter = productConverter
module.exports.timeConverter = timeConverter
module.exports.userConverter = userConverter
module.exports.paginationList = paginationList
module.exports.capitalizeFirstLetter = capitalizeFirstLetter