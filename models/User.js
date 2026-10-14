const mongoose = require("mongoose");

const regSchema = new mongoose.Schema({
    username: {
        type: String,
        min: 3,
        max: 100,
        required: true,
    },
    email: {
        type: String,
        min: 3,
        max: 100,
        unique: true,
        required: true,
    },
    password: {
        type: String,
        minlength: 8,
        maxlength: 100, // Bcrypt hashes can be longer, better to have a safe max or none
        select: false,
    },
    role: {
        type: String,
        enum: ['buyer', 'seller', 'admin'],
        default: 'buyer'
    },
    phone: {
        type: String,
        minlength: 10, // Adjusted safe min length
        maxlength: 15, // Adjusted safe max length
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true, // Allows for unique but optional fields
    },
    avatar: {
        type: String,
    },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: Date,
    passwordChangedAt: Date,
    lastActive: Date,
    authMethod: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        select: false
    },
    verificationTokenExpires: {
        type: Date
    },
    isBanned: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("User", regSchema);
