const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    mobile: { type: String, required: true }  // Use 'mobile' consistently here
});

module.exports = mongoose.model('Contact', ContactSchema);
