var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var postSchema = Schema({
	appDate: {
		type: String,
		required: true
	},
	appTime: {
		type: String,
		required: true
	},
	comments: {
		type: String
	},
	slug: {
		type: String,
		required: true
	},
});

module.exports = mongoose.model('Post', postSchema);