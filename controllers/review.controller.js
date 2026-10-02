const mongoose = require('mongoose');
const Review = require('../models/Reviews');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { STATUS_CODES, MESSAGES } = require('../config/constants');
const { Property } = require('../models/Property');

module.exports.addReview = asyncHandler(async (req, res) => {
    const { id: propertyId } = req.params;
    const { message, rating } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Invalid Property Id");
    }

    const property = await Property.findById(propertyId);
    if (!property) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.PROPERTY.NOT_FOUND);
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ propertyId, userId });
    if (existingReview) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "You have already reviewed this property");
    }

    const newReview = new Review({
        propertyId,
        userId,
        name: req.user.username,
        message,
        rating,
    });

    await newReview.save();
    res.status(STATUS_CODES.CREATED).json(new ApiResponse(STATUS_CODES.CREATED, newReview, "Review submitted successfully"));
});

module.exports.getPropertyReviews = asyncHandler(async (req, res) => {
    const { id: propertyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Invalid Property Id");
    }

    const reviews = await Review.find({ propertyId }).sort({ createdAt: -1 });
    res.json(new ApiResponse(STATUS_CODES.OK, { reviews }, "Reviews fetched successfully"));
});
