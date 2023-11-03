
const modelMapper = (value,prismaModel) => {
    // ref: https://stackoverflow.com/questions/5072136/javascript-filter-for-objects
    // filter customize from fromEntiries and reduce entries
    Object.filter = (obj, predicate) => Object.fromEntries(Object.entries(obj).filter(predicate));

    // check object name from model and return
    return Object.filter(value, ([name, value]) => prismaModel[name]);
}

module.exports.modelMapper = modelMapper