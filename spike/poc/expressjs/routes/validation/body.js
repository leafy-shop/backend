
const { validatError } = require('./../model/error/error')
const argon2 = require("argon2")

const validateStr = (prop = '', value = '', length = 0, isEmpty = false) => {
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

const validateInt = (prop = '', value = 0, isNan = false, min = 0, max = Infinity) => {
    console.log("validate number of " + prop)
    // validate is null or null value or negative value
    if (!isNan && isNaN(value)) {
        validatError(`${prop} is nan`)
    }

    // validate integer format
    if (value % 1 !== 0) {
        validatError(`${prop}:${value} is not integer number format`)
    }

    // validate min and max number
    if (value < min) {
        validatError(`${prop}:${value} is less than ${min}`)
    } else if (value > max) {
        validatError(`${prop}:${value} is more than ${max}`)
    }
    console.log(`validate ${prop} is passed`)
    return Math.trunc(value)
}

const validateDouble = (prop = '', value = 0, isNan = false, min = 0, max = Infinity) => {
    console.log("validate number of " + prop)
    // validate is null or null value or negative value
    if (!isNan && isNaN(value)) {
        validatError(`${prop} is nan`)
    }
    // validate double format
    if (typeof value !== 'number') {
        validatError(`${prop}:${value} is not float number format`)
    }

    // validate min and max number
    if (value < min) {
        validatError(`${prop}:${value} is less than ${min}`)
    } else if (value > max) {
        validatError(`${prop}:${value} is more than ${max}`)
    }
    console.log(`validate ${prop} is passed`)
    return value
}

const validateBoolean = (prop = '', value = false) => {
    console.log("validate boolean of " + prop)
    // validate boolean format
    if (![true, false].includes(value)) {
        validatError(`${prop}: value is not boolean format`)
    }
    console.log(`validate ${prop} is passed`)
    return value
}

const validateEmail = (prop = '', value = '', length = 0) => {
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
    return value.trim().toLowerCase()
}

const validatePassword = async (prop = '', value = '', atLeast = 0, atMost = 0) => {
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

const validateRole = (prop = '', value = '', enumtype, isEmpty = false) => {
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

const validateStrArray = (prop = '', values = [], ArrL, inArrL, upper = false) => {
    console.log("validate array of " + prop)
    // check values is array or not
    if (!(values instanceof Array)) {
        validatError(`${prop}:${values} is not array`)
    }
    if (values.length > ArrL) {
        validatError(`length of ${prop}:${values} have array length more than ${ArrL}`)
    }

    // check values is array then value is null, undefined and empty string
    values = values.filter(v => !(v == undefined || v == null || v.trim().length == 0))

    console.log(inArrL)
    // validate string in array and return to lower case values
    values = upper ? values.map((v, i) => validateStr(`${prop} - ${i + 1}:${v}`, v, inArrL).toUpperCase()) :
        values.map((v, i) => validateStr(`${prop} - ${i + 1}`, v, inArrL).toLowerCase())

    // remove duplicated values
    values = [...new Set(values)]

    // check if array is empty then refill then with empty string
    if (values.length == 0) {
        values.push("")
    }

    console.log(`validate ${prop} is passed`)

    // finally return string of value when comma by each item 
    return values.join()
}

const validateDatetimeFuture = (prop = '', value = undefined, isEmpty = false) => {
    console.log("validate date of " + prop)

    // check time format
    if (!isEmpty && (value == undefined || value.length == 0)) {
        validatError(`${prop} is null`)
    }

    // check value is undefined before add
    value = value !== undefined ? new Date(value) : undefined
    if (value == "Invalid Date") {
        validatError(`this ${prop} data is not date format`)
    }

    // check future time
    if (value !== undefined && value.getTime() >= (new Date()).getTime()) {
        validatError(`${prop}:${value} is not over than present`)
    }

    console.log(`validate ${prop} is passed`)
    return value
}

const validatePhone = (prop = '', value = undefined) => {
    let re = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})|\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})[- ]?\d{1}$/;
    // validate is null or null value
    if (value !== undefined && !value.match(re)) {
        validatError(`${prop} is not phone format`)
    }
    console.log(`validate ${prop} is passed`)
    return value === undefined ? undefined : value.replace(/-/g, '');
}

const validateCode = (prop = '', value = '', length = 0, arrayCodeDigit = []) => {


    // validate is null or null value or negative value
    if (value == undefined || value.length == 0) {
        validatError(`${prop} is null`)
    }
    // validate string format
    if (typeof value !== 'string') {
        validatError(`${prop}:${value} is not string format`)
    }

    value = value.trim()

    // validate string length
    if (value.length > length) {
        validatError(`${prop}:${value} have length more than ${length} characters`)
    }
    
    // validate is number in string
    if (arrayCodeDigit.length == 0) {
        let re = new RegExp(`^\\d{${length}}$`);
        if (!re.test(value)) {
            validatError(`${prop}:${value} is not code from ${prop} format`)
        }
        return value
    } else {
        // Loop through the array of custom numbers
        for (number of arrayCodeDigit) {
            // Create the regular expression dynamically
            let re = new RegExp(`^\\d{${number}}$`);

            // Test the input against the regular expression
            if (re.test(value)) {
                console.log(`validate ${prop} is passed`)
                console.log(value)
                return value;
            }
            
        }
        validatError(`${prop}:${value} is not code from ${prop} format`)
    }
}

module.exports.validateStr = validateStr
module.exports.validateInt = validateInt
module.exports.validateBoolean = validateBoolean
module.exports.validateEmail = validateEmail
module.exports.validatePassword = validatePassword
module.exports.validateRole = validateRole
module.exports.validateDouble = validateDouble
module.exports.validateStrArray = validateStrArray
module.exports.validateDatetimeFuture = validateDatetimeFuture
module.exports.validatePhone = validatePhone
module.exports.validateCode = validateCode