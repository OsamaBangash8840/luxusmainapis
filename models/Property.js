const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    location: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    type: String,
    buildYear: Number,
    size: String,
    lotSize: String,
    amenities: [String],
    images: [String],

    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['approved', 'pending', 'rejected'],
        default: 'pending'
    },
    propertyStatus: {
        type: String,
        enum: ['sold', 'for sale', 'under offer'],
        default: 'for sale'
    },
    rejectionReason: {
        type: String
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    views: { type: Number, default: 0 }
}, { timestamps: true });

// Create indexes
propertySchema.index({ location: "2dsphere" });
propertySchema.index({ status: 1 });
propertySchema.index({ seller: 1 });
propertySchema.index({ category: 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ title: 'text', description: 'text' });

const Property = mongoose.model('Property', propertySchema);

module.exports = { Property };
