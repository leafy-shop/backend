
const fs = require("fs")
const { generateId } = require("../converterUtils")
const { ROLE } = require("../../../enum/role")
const { stringify } = require("csv-stringify");
const { response } = require("express");
const { ITEMTYPE } = require("../../../enum/item");

const users = []
const items = []

// ref https://stackoverflow.com/questions/30115860/how-can-i-randomly-generate-a-number-in-the-range-0-5-and-0-5
// Returns a random number between min (inclusive) and max (exclusive)
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

function generateUser() {
    const columns = ["userId", "role", "response"]
    let writableStream = fs.createWriteStream("train/demo/leafyUser.csv")
    const stringifier = stringify({ header: true, columns: columns });

    for (let i = 0; i < 1000; i++) {
        let roleRandom = Math.random()
        let user = {
            userId: generateId(16),
            role: roleRandom < 0.9 ? ROLE.User : roleRandom < 0.95 ? ROLE.Supplier : ROLE.GD_DESIGNER,
            response: 0
        }
        if ([ROLE.Supplier, ROLE.GD_DESIGNER].includes(user.role)) {
            let responseRandom = Math.random()
            user.response = responseRandom < 0.15 ? getRandomArbitrary(0.9, 1) :
                responseRandom < 0.3 ? getRandomArbitrary(0.8, 0.9) :
                    responseRandom < 0.5 ? getRandomArbitrary(0.7, 0.8) :
                        responseRandom < 0.65 ? getRandomArbitrary(0.6, 0.7) :
                            responseRandom < 0.85 ? getRandomArbitrary(0.5, 0.6) :
                                responseRandom < 0.95 ? getRandomArbitrary(0.4, 0.5) :
                                    getRandomArbitrary(0, 0.4)
        }
        users.push(user)
        stringifier.write(user)
    }
    stringifier.pipe(writableStream);
    console.log("Finished writing data");
}


function generateItem() {
    const columns = ["itemId", "itemType", "itemPrice", "itemRating", "itemOwner"]
    let writableStream = fs.createWriteStream("train/demo/leafyItem.csv")
    const stringifier = stringify({ header: true, columns: columns });

    for (let i = 0; i < 5000; i++) {
        let itemTypeRandom = Math.random()
        let itemPriceRandom = Math.random()
        let itemRatingRandom = Math.random()
        let supplierUser = users.filter(user => user.role === ROLE.Supplier)
        let item = {
            itemId: generateId(16),
            itemType: itemTypeRandom < 0.3 ? ITEMTYPE.PLANT :
                itemTypeRandom < 0.5 ? ITEMTYPE.FLOWER :
                    itemTypeRandom < 0.6 ? ITEMTYPE.CACTUS :
                        itemTypeRandom < 0.7 ? ITEMTYPE.SEED :
                            itemTypeRandom < 0.85 ? ITEMTYPE.EQUIREMENT : ITEMTYPE.MATERIAL,
            itemPrice: itemTypeRandom < 0.3 ? (
                itemPriceRandom < 0.4 ? Math.round(getRandomArbitrary(10, 100)) : // 40% generate plant price between 10 and 100 baht
                    itemPriceRandom < 0.7 ? Math.round(getRandomArbitrary(100, 250)) :
                        itemPriceRandom < 0.9 ? Math.round(getRandomArbitrary(250, 500)) :
                            Math.round(getRandomArbitrary(500, 2000))
            ) :
                itemTypeRandom < 0.5 ? (
                    itemPriceRandom < 0.5 ? Math.round(getRandomArbitrary(30, 100)) : // 50% generate flower price between 30 and 100 baht
                        itemPriceRandom < 0.8 ? Math.round(getRandomArbitrary(100, 250)) :
                            itemPriceRandom < 0.95 ? Math.round(getRandomArbitrary(250, 500)) :
                                Math.round(getRandomArbitrary(500, 2000))
                ) :
                    itemTypeRandom < 0.6 ? (
                        itemPriceRandom < 0.6 ? Math.round(getRandomArbitrary(10, 100)) : // 60% generate cactus price between 10 and 100 baht
                            itemPriceRandom < 0.8 ? Math.round(getRandomArbitrary(100, 250)) :
                                itemPriceRandom < 0.9 ? Math.round(getRandomArbitrary(250, 500)) :
                                    Math.round(getRandomArbitrary(500, 2000))
                    ) :
                        itemTypeRandom < 0.7 ? (
                            itemPriceRandom < 0.25 ? Math.round(getRandomArbitrary(30, 100)) : // 25% generate seed price between 30 and 100 baht
                                itemPriceRandom < 0.5 ? Math.round(getRandomArbitrary(100, 250)) :
                                    itemPriceRandom < 0.75 ? Math.round(getRandomArbitrary(250, 500)) :
                                        Math.round(getRandomArbitrary(500, 2000))
                        ) :
                            itemTypeRandom < 0.85 ? (
                                itemPriceRandom < 0.2 ? Math.round(getRandomArbitrary(20, 100)) : // 20% generate equipment price between 30 and 100 baht
                                    itemPriceRandom < 0.8 ? Math.round(getRandomArbitrary(100, 250)) :
                                        itemPriceRandom < 0.99 ? Math.round(getRandomArbitrary(250, 500)) :
                                            Math.round(getRandomArbitrary(500, 2000))
                            ) : (
                                itemPriceRandom < 0.4 ? Math.round(getRandomArbitrary(10, 100)) : // 40% generate equipment price between 30 and 100 baht
                                    itemPriceRandom < 0.6 ? Math.round(getRandomArbitrary(100, 250)) :
                                        itemPriceRandom < 0.8 ? Math.round(getRandomArbitrary(250, 500)) :
                                            Math.round(getRandomArbitrary(500, 2000))
                            ),
            itemRating: itemRatingRandom < 0.3 ? Math.round(getRandomArbitrary(4.5, 5) * 10) / 10 :
                itemRatingRandom < 0.5 ? Math.round(getRandomArbitrary(4, 4.5) * 10) / 10 :
                    itemRatingRandom < 0.65 ? Math.round(getRandomArbitrary(3.5, 4) * 10) / 10 :
                        itemRatingRandom < 0.75 ? Math.round(getRandomArbitrary(3, 3.5) * 10) / 10 :
                            itemRatingRandom < 0.9 ? Math.round(getRandomArbitrary(2.5, 3) * 10) / 10 :
                                itemRatingRandom < 0.95 ? Math.round(getRandomArbitrary(2, 2.5) * 10) / 10 :
                                    Math.round(getRandomArbitrary(1, 2) * 10) / 10,
            itemOwner: supplierUser[Math.random() * supplierUser.length | 0].userId
        }
        items.push(item)
        stringifier.write(item)
    }
    console.log(items.filter(item => item.itemOwner === users.filter(user => user.role === ROLE.Supplier)[0].userId).length)
    stringifier.pipe(writableStream);
    console.log("Finished writing data");
}

function generateEvent() {
    const columns = ["userId", "itemId", "itemEvent"]
    let writableStream = fs.createWriteStream("train/demo/leafyEvent.csv")
    const stringifier = stringify({ header: true, columns: columns });

    for (let i = 0; i < 200000; i++) {
        let eventRandom = Math.random()
        let userRandom = users[Math.random() * users.length | 0].userId
        let itemRandom = Math.random()
        let itemOwnerRandom = items[itemRandom * items.length | 0].itemOwnerRandom

        // check user match to your self product
        function matchRandom(itemOwnerRandom, userRandom) {
            // console.log(itemRandom.itemOwner !== userRandom.userId)
            if (itemOwnerRandom !== userRandom) {
                return items[itemRandom * items.length | 0].itemId
            } else {
                setTimeout(function() {
                    matchRandom(itemOwnerRandom, userRandom)
                }, 0)
            }
        }

        let itemIdRandom = matchRandom(itemOwnerRandom, userRandom)
        // console.log(itemRandom)
            
        let event = {
            userId: userRandom,
            itemId: itemIdRandom,
            itemEvent: eventRandom < 0.9 ? "view" : eventRandom < 0.98 ? "addtocart" : "paid"
        }
        stringifier.write(event)
    }
    stringifier.pipe(writableStream);
    console.log("Finished writing data");
}

generateUser()
generateItem()
generateEvent()