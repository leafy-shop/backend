const crypto = require('crypto')
const { validatError } = require('./../model/error/error')
const argon2 = require("argon2")

let validateStr = (prop = '', value = '', length = 0, isEmpty = false) => {
    console.log("validate string of " + prop)
    if (!isEmpty && (value == undefined || value.length == 0)) {
        validatError(`${prop} is null`)
    }
    if (typeof value !== 'string') {
        validatError(`${prop}:${value} is not string format`)
    }
    if (value.length > length) {
        validatError(`${prop}:${value} have length more than ${length} characters`)
    }
    console.log(`validate ${prop} is passed`)
    return value.trim()
}

let validateInt = (prop = '', value = 0, isNan = false) => {
    console.log("validate number of " + prop)
    // console.log(value)
    if (!isNan && (isNaN(value) || value <= 0)) {
        validatError(`${prop} is nan`)
    }
    if (typeof value !== 'number') {
        // value = Number(value)

        validatError(`${prop}:${value} is not number format`)
    }
    console.log(`validate ${prop} is passed`)
    return Math.trunc(value)
}

let validateDouble = (prop = '', value = 0, isNan = false) => {
    console.log("validate number of " + prop)
    // console.log(value)
    if (!isNan && (isNaN(value) || value <= 0)) {
        validatError(`${prop} is nan`)
    }
    if (typeof value !== 'number') {
        value = Number(value)

        validatError(`${prop}:${value} is not number format`)
    }
    console.log(`validate ${prop} is passed`)
    return value
}

let validateBoolean = (prop = '', value = false) => {
    console.log("validate boolean of " + prop)
    if ([true, false].includes(value)) {
        validatError(`${prop}: value is not boolean format`)
    }
    console.log(`validate ${prop} is passed`)
    return value
}

let validateEmail = (prop = '', value = '', length = 0) => {
    console.log("validate email of " + prop)
    regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (value == undefined || value.length == 0) {
        validatError(`${prop} is null`)
    }
    if (!String(value).match(regex)) {
        validatError(`${prop}:${value} is not email format`)
    }
    if (value.length > length) {
        validatError(`${prop}:${value} have length more than ${length} characters`)
    }
    console.log(`validate ${prop} is passed`)
    return value.trim()
}



let validatePassword = async (prop = '', value = '', atLeast = 0, atMost = 0) => {
    console.log("validate password of " + prop)
    if (value == undefined || value.length == 0) {
        validatError(`${prop} is null`)
    }
    if (typeof value !== 'string') {
        validatError(`${prop}:${value} is not password format`)
    }
    if (value.length > atMost || value.length < atLeast) {
        validatError(`${prop}:${value} must have length ${atLeast}-${atMost} characters`)
    }
    console.log(`validate ${prop} is passed`)

    const hashingConfig = { // based on OWASP cheat sheet recommendations (as of March, 2022)
        parallelism: 1,
        memoryCost: 64000, // 64 mb
        timeCost: 3 // number of itetations
    }
    let salt = crypto.randomBytes(16)
    return await argon2.hash(value.trim(), { ...hashingConfig, salt })
}

let validateRole = (prop = '', value = '', enumtype, isEmpty = false) => {
    console.log("validate role of " + prop)
    if (!isEmpty && (value == undefined || value.length == 0)) {
        validatError(`${prop} is null`)
    }
    if (typeof value !== 'string') {
        validatError(`${prop}:${value} is not string format`)
    }
    for (let i in enumtype) {
        if (value.toString().trim() == enumtype[i]) {
            console.log(`validate ${prop} is passed`)
            return value.trim()
        }
    }
    validatError(`${prop}:${value} is not in this types`)
}

module.exports.validateStr = validateStr
module.exports.validateInt = validateInt
module.exports.validateBoolean = validateBoolean
module.exports.validateEmail = validateEmail
module.exports.validatePassword = validatePassword
module.exports.validateRole = validateRole
module.exports.validateDouble = validateDouble