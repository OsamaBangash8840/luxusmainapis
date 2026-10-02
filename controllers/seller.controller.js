const { Property } = require('../models/Property');
const Tour = require('../models/Tour');
const Conversation = require('../models/Conversation');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { STATUS_CODES } = require('../config/constants');

const mongoose = require('mongoose');

/**
 * @desc Get seller dashboard statistics
 * @route GET /api/seller/stats
 * @access Private/Seller
 */
module.exports.getSellerStats = asyncHandler(async (req, res) => {
    try {
        const sellerId = req.user.id;
        const sellerObjId = new mongoose.Types.ObjectId(sellerId);

        // Listing counts by status
        const approvedCount = await Property.countDocuments({ seller: sellerObjId, status: 'approved' });
        const pendingCount = await Property.countDocuments({ seller: sellerObjId, status: 'pending' });
        const rejectedCount = await Property.countDocuments({ seller: sellerObjId, status: 'rejected' });
        
        const listingCounts = {
            approved: approvedCount,
            pending: pendingCount,
            rejected: rejectedCount,
            total: approvedCount + pendingCount + rejectedCount
        };

        // Total views for all properties
        const sellerProperties = await Property.find({ seller: sellerObjId }).select('views _id');
        let totalViews = 0;
        const propertyIds = [];
        sellerProperties.forEach(p => {
            totalViews += (p.views || 0);
            propertyIds.push(p._id);
        });

        // Tours booked
        
        let toursBooked = 0;
        if (propertyIds.length > 0) {
            toursBooked = await Tour.countDocuments({
                $or: propertyIds.map(id => ({ propertyId: id })),
                status: 'scheduled'
            });
        }
        // Open offers (Conversations for their properties)
        const openOffers = await Conversation.countDocuments({ sellerId: sellerObjId });

        const stats = {
            listingCounts,
            totalViews,
            toursBooked,
            openOffers
        };

        res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, stats, 'Seller statistics retrieved'));
    } catch (e) {
        console.error("DEBUG ERROR", e);
        throw e;
    }
});
