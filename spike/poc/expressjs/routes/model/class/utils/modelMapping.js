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

module.exports.modelMapper = modelMapper
module.exports.deleteNullValue = deleteNullValue