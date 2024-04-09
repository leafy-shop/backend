const objectFilter = (obj, predicate) => Object.fromEntries(Object.entries(obj).filter(predicate));

const modelMapper = (value,prismaModel) => {
    // ref: https://stackoverflow.com/questions/5072136/javascript-filter-for-objects
    // filter customize from fromEntiries and reduce entries
    Object.filter = objectFilter

    // check object name from model and return
    return Object.filter(value, ([name, value]) => prismaModel[name]);
}

const deleteNullValue = (value) => {
    Object.filter = objectFilter
    return Object.filter(value, ([name, value]) => value !== null && value !== undefined && value.length !== 0);
}

const sanitizeCircularReferences = (obj, visited = new WeakSet()) => {
    // If obj is not an object or is null, return it as is
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    // If obj has been visited before, return a placeholder
    if (visited.has(obj)) {
        return '[Circular]';
    }

    // Mark obj as visited to prevent revisiting it
    visited.add(obj);

    // Create a new object to store sanitized properties
    const sanitizedObj = Array.isArray(obj) ? [] : {};

    // Iterate over each property of the object
    for (const key in obj) {
        // Skip prototype properties
        if (!obj.hasOwnProperty(key)) {
            continue;
        }

        // Recursively sanitize the property value
        sanitizedObj[key] = sanitizeCircularReferences(obj[key], visited);
    }

    // Return the sanitized object
    return sanitizedObj;
}

module.exports.modelMapper = modelMapper
module.exports.deleteNullValue = deleteNullValue
module.exports.sanitizeCircularReferences = sanitizeCircularReferences