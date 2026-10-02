const mongoose = require('mongoose');

const PropertyViewSchema = new mongoose.Schema({
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    ipAddress: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 3600 } // TTL index for 1 hour
});

PropertyViewSchema.index({ propertyId: 1, ipAddress: 1 }, { unique: true });

module.exports = mongoose.model('PropertyView', PropertyViewSchema);
