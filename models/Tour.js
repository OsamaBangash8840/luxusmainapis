const mongoose = require('mongoose');

const TourSchema = new mongoose.Schema({
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true }, // Link to Property
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: Date, required: true },  // Start of booking slot
    endTime: { type: Date, required: true },    // End of booking slot
    message: { type: String, required: true },
    isPremium: { type: Boolean, default: false },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'not_applicable'],
        default: 'not_applicable'
    },
    paymentIntentId: { type: String, unique: true, sparse: true },
    amountPaid: { type: Number },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: ['scheduled', 'cancelled', 'completed'],
        default: 'scheduled'
    },
    reminderSent: { type: Boolean, default: false }
}, { timestamps: true });

TourSchema.index(
    { propertyId: 1, startTime: 1 },
    { unique: true, partialFilterExpression: { status: 'scheduled' } }
);

module.exports = mongoose.model("Tour", TourSchema);
