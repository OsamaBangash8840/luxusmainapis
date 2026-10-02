const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        enum: ['apartment', 'condo', 'house', 'villa', 'shop', 'office'],
        required: true
    },
    images: [String] // Array of image URLs for the category
});

module.exports = mongoose.model('Category', categorySchema);
