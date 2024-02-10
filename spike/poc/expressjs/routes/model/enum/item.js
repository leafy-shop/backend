const ITEMTYPE = Object.freeze({
    PLANT: 'plant',
    FLOWER: 'flower', 
    CACTUS: 'cactus', 
    SEED: "seed", 
    EQUIREMENT: "equirement", 
    MATERIAL: "material",
})

const ITEMSIZE = Object.freeze({
    XXXS: 'XXXS',
    XXS: 'XXS',
    XS: 'XS',
    S: 'S',
    M: 'M',
    L: 'L',
    XL: 'XL',
    XXL: 'XXL',
    XXXL: 'XXXL',
    No: 'No'
})

const ITEMEVENT = Object.freeze({
    View: "view",
    ATC: "adtc",
    PAID: "paid"
})

module.exports.ITEMTYPE = ITEMTYPE
module.exports.ITEMSIZE = ITEMSIZE
module.exports.ITEMEVENT = ITEMEVENT