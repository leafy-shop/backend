const { DateTime } = require("luxon");
const { months } = require("moment");

const dateTimeZoneNow = (date) => {
    // Set the target timezone to UTC+7:00
    const timeZone = 'Asia/Bangkok';

    // Format the date with the new timezone
    const options = {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour12: false, // Use 24-hour format
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    };

    // Use the IANA time zone identifier for your target timezone
    return new Intl.DateTimeFormat('en-US', options).format(date);
}

const getDifferentTime = (jsdate) => {
    // create compare values
    const dateTime = DateTime.fromJSDate(jsdate, 'MM/dd/yyyy, HH:mm:ss', { zone: 'Asia/Bangkok' }).toISO();
    const now = DateTime.now();

    // find different at time by luxon
    const second = now.diff(DateTime.fromISO(dateTime), 'seconds').toObject().seconds;
    const minute = now.diff(DateTime.fromISO(dateTime), 'minutes').toObject().minutes;
    const hour = now.diff(DateTime.fromISO(dateTime), 'hours').toObject().hours;
    const day = now.diff(DateTime.fromISO(dateTime), 'days').toObject().days;
    const week = now.diff(DateTime.fromISO(dateTime), 'weeks').toObject().weeks;
    const month = now.diff(DateTime.fromISO(dateTime), 'months').toObject().months;
    const year = now.diff(DateTime.fromISO(dateTime), 'years').toObject().years;

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
module.exports.getDifferentTime = getDifferentTime