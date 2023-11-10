const moment = require('moment')

let validatError = (msg) => {
    let error = new Error(msg)
    error.name = `Validation Error`
    throw error
}

let notFoundError = (msg) => {
    let error = new Error(msg)
    error.name = `Not Found Error`
    error.status = 404
    throw error
}

let forbiddenError = (msg) => {
    let error = new Error(msg)
    error.name = `Forbidden Error`
    error.status = 403
    throw error
}

let unAuthorizedError = (msg) => {
    let error = new Error(msg)
    error.name = `Unauthorized Error`
    error.status = 401
    throw error
}

let errorRes = (msg, endpoint) => {
    return {
        error: msg,
        endpoint: endpoint,
        timestamp: moment().format()
    }
}

module.exports.errorRes = errorRes
module.exports.validatError = validatError
module.exports.notFoundError = notFoundError
module.exports.forbiddenError = forbiddenError
module.exports.unAuthorizedError = unAuthorizedError