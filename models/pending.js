var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var pendingSchema = Schema({
    appDate: {
        type: String,
        required: true
    },
    appTime: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    facebookId: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    email: {
        type: String
    },
    comments: {
        type: String
    },
    slug: {
        type: String,
        required: true
    },
});

module.exports = mongoose.model('pending', pendingSchema);
