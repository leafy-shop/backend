const mongoose = require('mongoose');
require('dotenv').config().parsed

// Check if database connection is needed
if (process.env.CONNECT_TO_MONGO === 'true') {
    mongoose.connect('mongodb://localhost:27018/chat', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    const db = mongoose.connection;

    db.on('error', (err) => {
        console.log('Connection error');
    });
    db.once('open', function () {
        console.log('Connected to MongoDB database');
    });

} else {
    console.log('Skipping MongoDB connection.');
}

module.exports = mongoose