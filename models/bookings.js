var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var bookingSchema = Schema({
	appDateTime: {
		type: String,
		required: true
	},
	name: {
		type: String,
		required: true
	},
	phone_number: {
		type: String,
		required: true
	},
	email_address: {
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

module.exports = mongoose.model('Book', bookingSchema);