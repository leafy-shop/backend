
const { validatError } = require('./../model/error/error')
const argon2 = require("argon2")

let validateStr = (prop = '', value = '', length = 0, isEmpty = false) => {
    console.log("validate string of " + prop)
    // validate is null or null value or negative value
    if (!isEmpty && (value == undefined || value.length == 0)) {
        validatError(`${prop} is null`)
    }
    // validate string format
    if (typeof value !== 'string') {
        validatError(`${prop}:${value} is not string format`)
    }
    // validate string length
    if (value.length > length) {
        validatError(`${prop}:${value} have length more than ${length} characters`)
    }
    console.log(`validate ${prop} is passed`)
    return value.trim()
}

let validateInt = (prop = '', value = 0, isNan = false) => {
    console.log("validate number of " + prop)
    // validate is null or null value or negative value
    if (!isNan && (isNaN(value) || value <= 0)) {
        validatError(`${prop} is nan`)
    }
    // validate number format
    if (typeof value !== 'number') {
        validatError(`${prop}:${value} is not number format`)
    }
    console.log(`validate ${prop} is passed`)
    return Math.trunc(value)
}

let validateDouble = (prop = '', value = 0, isNan = false) => {
    console.log("validate number of " + prop)
    // validate is null or null value or negative value
    if (!isNan && (isNaN(value) || value <= 0)) {
        validatError(`${prop} is nan`)
    }
    // validate number format
    if (typeof value !== 'number') {
        value = Number(value)

        validatError(`${prop}:${value} is not number format`)
    }
    console.log(`validate ${prop} is passed`)
    return value
}

let validateBoolean = (prop = '', value = false) => {
    console.log("validate boolean of " + prop)
    // validate boolean format
    if (![true, false].includes(value)) {
        validatError(`${prop}: value is not boolean format`)
    }
    console.log(`validate ${prop} is passed`)
    return value
}

let validateEmail = (prop = '', value = '', length = 0) => {
    console.log("validate email of " + prop)
    regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    // validate is null or null value
    if (value == undefined || value.length == 0) {
        validatError(`${prop} is null`)
    }
    // validate email format
    if (!String(value).match(regex)) {
        validatError(`${prop}:${value} is not email format`)
    }
    // validate string length
    if (value.length > length) {
        validatError(`${prop}:${value} have length more than ${length} characters`)
    }
    console.log(`validate ${prop} is passed`)
    return value.trim()
}

let validatePassword = async (prop = '', value = '', atLeast = 0, atMost = 0) => {
    console.log("validate password of " + prop)
    // validate is null or null value
    if (value == undefined || value.length == 0) {
        validatError(`${prop} is null`)
    }
    // validate string format
    if (typeof value !== 'string') {
        validatError(`${prop}:${value} is not password format`)
    }
    // validate length of password
    if (value.length > atMost || value.length < atLeast) {
        validatError(`${prop}:${value} must have length ${atLeast}-${atMost} characters`)
    }
    console.log(`validate ${prop} is passed`)

    // return argon2 hashing
    const hashingConfig = { // based on OWASP cheat sheet recommendations (as of March, 2022)
        parallelism: 1,
        memoryCost: 64000, // 64 mb
        timeCost: 3 // number of itetations
    }
    return await argon2.hash(value.trim(), { ...hashingConfig })
}

let validateRole = (prop = '', value = '', enumtype, isEmpty = false) => {
    console.log("validate role of " + prop)
    // validate is null or null value
    if (!isEmpty && (value == undefined || value.length == 0)) {
        validatError(`${prop} is null`)
    }
    // validate string format
    if (typeof value !== 'string') {
        validatError(`${prop}:${value} is not string format`)
    }
    // validate enum type
    for (let i in enumtype) {
        if (value.toString().trim() == enumtype[i]) {
            console.log(`validate ${prop} is passed`)
            return value.trim()
        }
    }
    validatError(`${prop}:${value} is not in this types`)
}

let validateStrArray = (prop = '', values = [], ArrL, inArrL) => {
    console.log("validate array of " + prop)
    // check values is array or not
    if (!(values instanceof Array)) {
        validatError(`${prop}:${values} is not array`)
    }
    if (values.length > ArrL){
        validatError(`length of ${prop}:${values} is more than ${ArrL}`)
    }

    // check values is array then value is null, undefined and empty string
    values = values.filter(v => !(v == undefined || v == null || v.trim().length == 0))

    // validate string in array and return to lower case values
    values = values.map((v,i) => validateStr(`${prop} - ${i+1}:${v}`,v,inArrL).toLowerCase())

    // remove duplicated values
    values =  [...new Set(values)]

    // check if array is empty then refill then with empty string
    if (values.length == 0) {
        values.push("")
    }

    console.log(`validate ${prop} is passed`)

    // finally return string of value when comma by each item 
    return values.join()
}

module.exports.validateStr = validateStr
module.exports.validateInt = validateInt
module.exports.validateBoolean = validateBoolean
module.exports.validateEmail = validateEmail
module.exports.validatePassword = validatePassword
module.exports.validateRole = validateRole
module.exports.validateDouble = validateDouble
module.exports.validateStrArray = validateStrArray