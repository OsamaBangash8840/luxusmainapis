const mongoose = require('mongoose');

const FavoriteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true }
}, { timestamps: true });

FavoriteSchema.index({ userId: 1, propertyId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', FavoriteSchema);
