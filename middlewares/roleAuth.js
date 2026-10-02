const { STATUS_CODES } = require('../config/constants');
const ApiError = require('../utils/ApiError');

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new ApiError(STATUS_CODES.FORBIDDEN, `Role ${req.user ? req.user.role : 'none'} is not authorized to access this resource`));
        }
        next();
    };
};

module.exports = authorizeRoles;
