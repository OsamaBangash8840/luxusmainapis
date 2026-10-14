const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { STATUS_CODES, MESSAGES } = require('../config/constants');

// Middleware to verify the token from cookies or authorization header
const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED || 'Access denied. Please log in.');
    }

    const verified = jwt.verify(token, process.env.TOKEN_SECRET);

    // Verify user exists and check for password reset invalidation
    const user = await User.findById(verified.id).select('+isBanned +passwordChangedAt');
    if (!user || user.isBanned) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'User not found or account is deactivated');
    }

    // Invalidate session if password was reset after token was issued
    if (user.passwordChangedAt && verified.iat && verified.iat * 1000 < user.passwordChangedAt.getTime()) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Session expired. Password was recently changed, please log in again.');
    }

    req.user = verified;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    return next(new ApiError(STATUS_CODES.UNAUTHORIZED, 'Invalid or expired token'));
  }
};

module.exports = verifyToken;
