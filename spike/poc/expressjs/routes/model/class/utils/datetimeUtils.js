const { DateTime } = require("luxon");
const { months } = require("moment");

const dateTimeZoneNow = (date) => {
    // Set the target timezone to UTC+7:00
    // const timeZone = 'Asia/Bangkok';

    // Format the date with the new timezone
    const options = {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        // hour12: false, // Use 24-hour format
        // hour: '2-digit',
        // minute: '2-digit',
        // second: '2-digit',
    };

    // Use the IANA time zone identifier for your target timezone
    return new Intl.DateTimeFormat('th-TH', options).format(date);
}

const dateTimeZoneContentFormat = (date) => {
    // Set the target timezone to UTC+7:00
    // const timeZone = 'Asia/Bangkok';

    // Format the date with the new timezone
    const options = {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        // hour12: false, // Use 24-hour format
        // hour: '2-digit',
        // minute: '2-digit',
        // second: '2-digit',
    };

    // Use the IANA time zone identifier for your target timezone
    return new Intl.DateTimeFormat('en-US', options).format(date);
}

const dateTimeZoneReviewFormat = (date) => {
    // Set the target timezone to UTC+7:00
    // const timeZone = 'Asia/Bangkok';

    // Format the date with the new timezone
    const options = {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        // hour12: false, // Use 24-hour format
        // hour: '2-digit',
        // minute: '2-digit',
        // second: '2-digit',
    };

    // Use the IANA time zone identifier for your target timezone
    return new Intl.DateTimeFormat('en-GB', options).format(date);
}

const getDifferentTime = (jsdate) => {
    // create compare values
    const dateTime = new Date(jsdate.getTime() - 1000 * 60 * 60 * 7);
    const now = DateTime.local();
    // console.log(dateTime)
    // console.log(now)

    // find different at time by luxon
    const second = now.diff(DateTime.fromJSDate(dateTime), 'seconds').toObject().seconds;
    const minute = now.diff(DateTime.fromJSDate(dateTime), 'minutes').toObject().minutes;
    const hour = now.diff(DateTime.fromJSDate(dateTime), 'hours').toObject().hours;
    const day = now.diff(DateTime.fromJSDate(dateTime), 'days').toObject().days;
    const week = now.diff(DateTime.fromJSDate(dateTime), 'weeks').toObject().weeks;
    const month = now.diff(DateTime.fromJSDate(dateTime), 'months').toObject().months;
    const year = now.diff(DateTime.fromJSDate(dateTime), 'years').toObject().years;

    // check condition and return time status
    if (year >= 2) {
        return `${Math.floor(year)} years ago`;
    } else if (year >= 1) {
        return `1 year ago`;
    } else if (month >= 2) {
        return `${Math.floor(month)} months ago`;
    } else if (month >= 1) {
        return '1 month ago';
    } else if (week >= 2) {
        return `${Math.floor(week)} weeks ago`;
    } else if (week >= 1) {
        return '1 week ago';
    } else if (day >= 2) {
        return `${Math.floor(day)} days ago`;
    } else if (day >= 1) {
        return '1 day ago';
    } else if (hour >= 2) {
        return `${Math.floor(hour)} hours ago`;
    } else if (hour >= 1) {
        return '1 hour ago';
    } else if (minute >= 2) {
        return `${Math.floor(minute)} minutes ago`;
    } else if (minute >= 1) {
        return '1 minute ago';
    } else {
        return `${Math.floor(second)} seconds ago`;
    }
}

module.exports.dateTimeZoneNow = dateTimeZoneNow
module.exports.dateTimeZoneContentFormat = dateTimeZoneContentFormat
module.exports.dateTimeZoneReviewFormat = dateTimeZoneReviewFormat
module.exports.getDifferentTime = getDifferentTime