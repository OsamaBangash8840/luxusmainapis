const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    content: { type: String, required: true }, // Store text or file URL
    fileUrl: { type: String }, // For file uploads
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Read receipts
    isOffer: { type: Boolean, default: false },
    offerDetails: {
        amount: Number,
        counterAmount: Number,
        status: { type: String, enum: ['pending','accepted','rejected','countered','expired'] },
        expiresAt: Date,
        notes: String
    },
    edited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    reactions: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reaction: String
    }]
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
