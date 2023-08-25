const HttpStatus = require("http-status");
const { validationResults } = require("koa-req-validation")

const product_db = [
    {
        "id": 1,
        "product": "small graden",
        "price": 1000
    },
    {
        "id": 2,
        "product": "normal graden",
        "price": 3000
    },
    {
        "id": 3,
        "product": "large graden",
        "price": 5000
    }
]

const getP = (ctx) => {
    console.log(ctx.request.query)
    showProduct = product_db.filter(p => {
        return (ctx.request.query.product !== undefined ? p.product.includes((ctx.request.query.product)) : true) &&
        (ctx.request.query.price !== undefined ? p.price == ctx.request.query.price : true)
    })
    showProduct = showProduct.sort((a,b)=> b.price - a.price)
    ctx.body = showProduct;
    ctx.status = 200;
}

const addP = (ctx) => {
    const result = validationResults(ctx);
    if (result.hasErrors()) {
        ctx.throw(400, result);
    }
    const body = result.passedData()
    product_db.push(body)
    ctx.body = body;
    ctx.status = HttpStatus.CREATED
}

module.exports = { getP, addP }