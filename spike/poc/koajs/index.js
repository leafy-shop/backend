const Koa = require("koa");
const parser = require("koa-bodyparser");
const cors = require("@koa/cors");
const Logger = require("koa-logger");
const serve = require("koa-static");
const mount = require("koa-mount");
const HttpStatus = require("http-status");
const products = require("./api/productRoute")

const App = new Koa();
App.proxy = true;
const port = 8000;

App.use(parser())
    .use(cors())
    .listen(port, () => {
        console.log(`🚀 Server listening http://127.0.0.1:${port}/ 🚀`);
    });

// logger

// set logger
App.use(Logger())

// App.use(async (ctx, next) => {
//     await next();
//     const rt = ctx.response.get('X-Response-Time');
//     console.log(`${ctx.method} ${ctx.url} - ${rt}`);
// });

// x-response-time

// set response time
App.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
});

// allow use router for make api
App.use(products.routes()).use(products.allowedMethods());

App.on('error', (err, ctx) => {
    console.log(err)
})

// router.get('/api', async (ctx, next) => {
//     ctx.status = HttpStatus.OK
//     ctx.body = { msg: 'Hello World' };
//     await next();
// });

// router.get(`/products`, getP)
// router.post(`/products`, addP)

// App.use(async (ctx, next) => {

// })