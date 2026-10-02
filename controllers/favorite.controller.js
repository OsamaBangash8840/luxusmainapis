const Favorite = require('../models/Favorite');
const { Property } = require('../models/Property');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { STATUS_CODES, MESSAGES } = require('../config/constants');

/**
 * @desc Add property to favorites
 * @route POST /api/favorites/:propertyId
 * @access Private
 */
module.exports.addFavorite = asyncHandler(async (req, res) => {
    const { propertyId } = req.params;
    const userId = req.user.id;

    const property = await Property.findOne({ _id: propertyId, status: 'approved' });
    if (!property) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.PROPERTY.NOT_FOUND);
    }

    const existing = await Favorite.findOne({ userId, propertyId });
    if (existing) {
        throw new ApiError(STATUS_CODES.CONFLICT, 'Property already in favorites');
    }

    await Favorite.create({ userId, propertyId });
    res.status(STATUS_CODES.CREATED).json(new ApiResponse(STATUS_CODES.CREATED, null, 'Property added to favorites'));
});

/**
 * @desc Remove property from favorites
 * @route DELETE /api/favorites/:propertyId
 * @access Private
 */
module.exports.removeFavorite = asyncHandler(async (req, res) => {
    const { propertyId } = req.params;
    const userId = req.user.id;

    const result = await Favorite.findOneAndDelete({ userId, propertyId });
    if (!result) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, 'Property not in favorites');
    }

    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, 'Property removed from favorites'));
});

/**
 * @desc Get user favorites
 * @route GET /api/favorites
 * @access Private
 */
module.exports.getFavorites = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const favorites = await Favorite.find({ userId })
        .populate({
            path: 'propertyId',
            match: { status: 'approved' },
            select: 'title description price location category images status'
        })
        .sort({ createdAt: -1 });

    // Filter out favorites where property was deleted or unapproved
    const validFavorites = favorites.filter(f => f.propertyId != null);

    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, validFavorites, 'Favorites retrieved successfully'));
});
