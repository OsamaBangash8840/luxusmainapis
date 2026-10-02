const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

conversationSchema.index({ propertyId: 1, buyerId: 1, sellerId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
