const SavedSearch = require('../models/SavedSearch');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { STATUS_CODES } = require('../config/constants');

/**
 * @desc Add a new saved search
 * @route POST /api/saved-searches
 * @access Private
 */
module.exports.createSavedSearch = asyncHandler(async (req, res) => {
    const { name, filters } = req.body;
    const userId = req.user.id;

    if (!name) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Search name is required');
    }

    const savedSearch = await SavedSearch.create({
        userId,
        name,
        filters: filters || {}
    });

    res.status(STATUS_CODES.CREATED).json(new ApiResponse(STATUS_CODES.CREATED, savedSearch, 'Saved search created'));
});

/**
 * @desc Get user's saved searches
 * @route GET /api/saved-searches
 * @access Private
 */
module.exports.getSavedSearches = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const savedSearches = await SavedSearch.find({ userId }).sort({ createdAt: -1 });

    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, savedSearches, 'Saved searches retrieved'));
});

/**
 * @desc Delete a saved search
 * @route DELETE /api/saved-searches/:id
 * @access Private
 */
module.exports.deleteSavedSearch = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await SavedSearch.findOneAndDelete({ _id: id, userId });
    if (!result) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, 'Saved search not found');
    }

    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, 'Saved search deleted'));
});
