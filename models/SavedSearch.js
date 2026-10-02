const mongoose = require('mongoose');

const SavedSearchSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    filters: {
        search: String,
        category: mongoose.Schema.Types.ObjectId,
        minPrice: Number,
        maxPrice: Number,
        bedrooms: Number,
        bathrooms: Number,
        propertyType: String
    },
    lastAlertSentAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('SavedSearch', SavedSearchSchema);
