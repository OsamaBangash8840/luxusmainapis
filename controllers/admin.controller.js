const { Property } = require("../models/Property");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const sendEmail = require("../utils/email");
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { MESSAGES, STATUS_CODES, ROLES, PROPERTY_STATUS } = require('../config/constants');
const logger = require('../utils/logger');




module.exports.getDashboardStats = asyncHandler(async (req, res) => {
    const stats = await Property.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
    const totalUsers = await User.countDocuments({ role: ROLES.SELLER });
    const totalProperties = await Property.countDocuments();
    const formattedStats = {
        users: totalUsers,
        properties: totalProperties,
        pending: stats.find(s => s._id === PROPERTY_STATUS.PENDING)?.count || 0,
        approved: stats.find(s => s._id === PROPERTY_STATUS.APPROVED)?.count || 0,
        rejected: stats.find(s => s._id === PROPERTY_STATUS.REJECTED)?.count || 0
    };
    res.json(new ApiResponse(STATUS_CODES.OK, formattedStats, MESSAGES.ADMIN.STATS_FETCHED));
});

module.exports.updatePropertyStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (![PROPERTY_STATUS.APPROVED, PROPERTY_STATUS.PENDING, PROPERTY_STATUS.REJECTED].includes(status)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Invalid Status");
    }

    if (status === PROPERTY_STATUS.REJECTED && !rejectionReason) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Rejection reason is required");
    }

    const property = await Property.findByIdAndUpdate(
        id,
        {
            status,
            ...(status === PROPERTY_STATUS.REJECTED && { rejectionReason }),
            reviewedBy: req.user._id,
            reviewedAt: new Date()
        },
        { new: true }
    ).populate('seller', 'username email');

    if (!property) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.PROPERTY.NOT_FOUND);
    }

    if (!property.seller) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, "Seller information not found");
    }

    const sellerEmail = property.seller.email;
    const sellerName = property.seller.username;

    const approvedLink = `${process.env.FRONTEND_URL}/properties/${property._id}`;
    const contactLink = `${process.env.FRONTEND_URL}/contact-us`;
    
    const escapeHtml = require('../utils/escapeHtml');

    if (status === PROPERTY_STATUS.APPROVED) {
        const html = `<p>Hello ${escapeHtml(sellerName)},</p>
                       <p>Your property has been approved by the admin. You can now view it on the website using the link below:</p>
                       <a href="${approvedLink}">View Property</a>`;
        await sendEmail({
            to: sellerEmail,
            subject: "Property Approved by Admin",
            html,
        });
        logger.info('Property approved', { propertyId: property._id, adminId: req.user.id });
        await AuditLog.create({ adminId: req.user.id, action: 'approve_property', targetId: property._id, targetModel: 'Property' });
    } else if (status === PROPERTY_STATUS.REJECTED) {
        const html = `<p>Hello ${escapeHtml(sellerName)},</p>
                       <p>Your property has been rejected by the admin. You can view the reason for rejection below:</p>
                       <p><strong>${escapeHtml(property.rejectionReason)}</strong></p>
                       <p>If you have any queries, you can contact the admin using the link below:</p>
                       <a href="${contactLink}">Ask Queries</a>`;
        await sendEmail({
            to: sellerEmail,
            subject: "Property Rejected by Admin",
            html,
        });
        logger.info('Property rejected', { propertyId: property._id, adminId: req.user.id, reason: rejectionReason });
        await AuditLog.create({ adminId: req.user.id, action: 'reject_property', targetId: property._id, targetModel: 'Property', details: { reason: rejectionReason } });
    }

    res.json(new ApiResponse(STATUS_CODES.OK, property, MESSAGES.ADMIN.PROPERTY_APPROVED));
});

module.exports.getUsers = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter)
        .select('-password -__v -resetPasswordToken -resetPasswordExpires -verificationToken -verificationTokenExpires')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, {
        users,
        pagination: {
            total,
            page,
            pages: Math.ceil(total / limit)
        }
    }, 'Users retrieved successfully'));
});

module.exports.banUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isBanned } = req.body;

    const user = await User.findById(id);
    if (!user) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, 'User not found');
    }

    if (user.role === ROLES.ADMIN) {
        throw new ApiError(STATUS_CODES.FORBIDDEN, 'Cannot ban an admin');
    }

    user.isBanned = !!isBanned;
    await user.save();

    const action = isBanned ? 'ban_user' : 'unban_user';
    await AuditLog.create({ adminId: req.user.id, action, targetId: user._id, targetModel: 'User' });
    
    // Disconnect sockets if user is banned
    if (isBanned) {
        const { getIO } = require('../socketConnection');
        try {
            const io = getIO();
            if (io) {
                io.sockets.sockets.forEach(socket => {
                    if (socket.user && socket.user.id === user._id.toString()) {
                        socket.disconnect(true);
                    }
                });
            }
        } catch (e) {
            logger.warn('Socket.io not initialized, skipping disconnect', { userId: user._id });
        }
    }

    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, { isBanned: user.isBanned }, `User ${isBanned ? 'banned' : 'unbanned'} successfully`));
});

module.exports.getPendingStatus = asyncHandler(async (req, res) => {
    const adminId = req.user.id;

    const admin = await User.findById(adminId);
    if (admin.role !== ROLES.ADMIN) {
        throw new ApiError(STATUS_CODES.FORBIDDEN, MESSAGES.ADMIN.ACCESS_DENIED);
    }

    const pendingProperties = await Property.find({ status: PROPERTY_STATUS.PENDING }).populate("seller", "username email");
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, { properties: pendingProperties }, MESSAGES.PROPERTY.FETCH_SUCCESS));
});

module.exports.getApprovedStatus = asyncHandler(async (req, res) => {
    const adminId = req.user.id;

    const admin = await User.findById(adminId);
    if (admin.role !== ROLES.ADMIN) {
        throw new ApiError(STATUS_CODES.FORBIDDEN, MESSAGES.ADMIN.ACCESS_DENIED);
    }

    const approvedProperties = await Property.find({ status: PROPERTY_STATUS.APPROVED }).populate("seller", "username email");
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, { properties: approvedProperties }, MESSAGES.PROPERTY.FETCH_SUCCESS));
});

module.exports.getRejectedStatus = asyncHandler(async (req, res) => {
    const adminId = req.user.id;

    const admin = await User.findById(adminId);
    if (admin.role !== ROLES.ADMIN) {
        throw new ApiError(STATUS_CODES.FORBIDDEN, MESSAGES.ADMIN.ACCESS_DENIED);
    }

    const rejectedProperties = await Property.find({ status: PROPERTY_STATUS.REJECTED }).populate("seller", "username email");
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, { properties: rejectedProperties }, MESSAGES.PROPERTY.FETCH_SUCCESS));
});