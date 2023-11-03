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

module.exports.dateTimeZoneNow = dateTimeZoneNow