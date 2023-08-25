
const Router = require("koa-router");
const { getP, addP } = require("./../service/product")
const { body } = require("koa-req-validation")

const products = new Router({ prefix: '/api/products'})

products.get(`/`, getP)
products.post(`/`,
    body("id").isNumeric().withMessage("The product is not number").build()
    ,body("product").isLength({ min: 0 }).withMessage("The product is null").build() 
    ,body("price").isNumeric().withMessage("The price is not number").build()
    ,addP)

module.exports = products