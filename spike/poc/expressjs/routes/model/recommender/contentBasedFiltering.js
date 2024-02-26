// https://github.com/webnexus-uk/video-recommendations-nodejs/blob/main/index.js
const fs = require('fs');
const { parse } = require('csv-parse')
const _ = require('lodash');

// Create Mock User
const mockUser = {
    userId: "1",
    itemType: ["flower", "material", "plant"]
};

// Filter results 

const filterItemPersonalization = () => {
    return new Promise((resolve, reject) => {
        let readEvent = []
        fs.createReadStream('./routes/model/recommender/train/demo/leafyEvent.csv').pipe(parse({ delimiter: ",", columns: true, ltrim: true }))
            .on("data", (row) => {
                // console.log(row)
                readEvent.push(row)
            })
            .on("error", (err) => reject(Error(err)))
            .on("end", () => {
                // console.log(readEvent.length)
                // let filteredData = readEvent.filter((event) => category.includes(event.itemType));
                // console.log(filteredData.length)
                resolve(readEvent);
            })
    })
}

// Get 10 results

const getTopItems = (data, category, weights, top_n = 10) => {
    let itemPriceList = []
    data.forEach(item => {
        itemPriceList.push(item.itemPrice)
    });
    const mean = meanP(itemPriceList)
    // console.log(mean)
    const sdp = sd(itemPriceList, mean)
    // console.log(sdp)
    return _.chain(data)
        .map((item) => [item.itemId, calculateWeight(item, mean, sdp, weights, category)])
        .groupBy((item) => item[0])
        .map((items) => {
            const totalWeights = _.sumBy(items, (item) => item[1]);
            const avgWeight = totalWeights / items.length;
            return { itemId: items[0][0], score: avgWeight }
        })
        .sortBy('score')
        .reverse()
        .take(top_n)
        .value()
}

// Calculation weights

// Create Weights
const weights = {
    totalRating: 3,
    itemPrice: 1,
    itemEvent: 1
}

const maxWeight = (weights) => Math.max(...Object.values(weights));
const meanP = (arr) => arr.reduce((pre, cur) => pre + Number(cur), 0) / arr.length // arithmetic mean
const sd = (arr, mean) => Math.sqrt(arr.reduce((pre, cur) => pre + Math.pow(Number(cur) - mean, 2)/ arr.length, 0)) // standard deviration
const normalProp = (x, mean, sd) => (1 / (Math.sqrt(2 * Math.PI) * sd)) * Math.exp(-(Math.pow(x - mean, 2) / (2 * sd))) // area of under normal distribution

const calculateWeight = (userData, mean, sdp, weights, category = []) => {
    let maxWeightValue = maxWeight(weights)
    const { itemType, itemRating, itemPrice, itemEvent } = userData;
    // console.log(category)
    // console.log(weights.totalRating)
    // console.log(itemRating)
    // console.log(itemRating > weights.totalRating)
    // console.log(normalProp(itemPrice / 100, maxWeightValue, sdp))
    const weight = itemRating / maxWeightValue +
    ((category.includes(itemType)) ? 1 : -1) / maxWeightValue +
    (normalProp(itemPrice / 100, mean, sdp)) / maxWeightValue +
    (itemEvent == "view" ? 0.5 : itemEvent == "adtc" ? 0.75 : 1) / maxWeightValue
    const weightType = category.filter(cate => cate === itemType).length;
    // console.log(category)
    return (weight / (weightType + weights.totalRating + weights.itemPrice + weights.itemEvent)) * 100;
};

// init()

// const init = async () => {
//     const filteredData = await filterItemPersonalization();
//     console.log(getTopItems(filteredData, mockUser.itemType, weights, 12));
// }

// init();

module.exports.getTopItems = getTopItems