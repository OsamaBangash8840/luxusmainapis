const mongoose = require('mongoose');

const reviewsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: {
        type: String,
        required: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
}, { timestamps: true });

reviewsSchema.index({ propertyId: 1, userId: 1 }, { unique: true });

const Review = mongoose.model('Reviews', reviewsSchema);

module.exports = Review;
