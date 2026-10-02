const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode ? error.statusCode : 500;
        const message = error.message || 'Internal Server Error';
        error = new ApiError(statusCode, message, false, err.stack);
    }

    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = new ApiError(400, message, true, err.stack);
    } else if (err.name === 'CastError') {
        const message = `Resource not found. Invalid: ${err.path}`;
        error = new ApiError(404, message, true, err.stack);
    } else if (err.code === 11000) {
        const message = `Duplicate ${Object.keys(err.keyValue)} entered`;
        error = new ApiError(400, message, true, err.stack);
    } else if (err.name === 'JsonWebTokenError') {
        const message = 'JSON Web Token is invalid. Try again!';
        error = new ApiError(401, message, true, err.stack);
    } else if (err.name === 'TokenExpiredError') {
        const message = 'JSON Web Token is expired. Try again!';
        error = new ApiError(401, message, true, err.stack);
    } else if (err.name === 'MulterError') {
        error = new ApiError(400, err.message, true, err.stack);
    }

    const response = {
        success: false,
        statusCode: error.statusCode,
        message: error.message,
        ...(error.errors && { errors: error.errors }),
        ...(process.env.NODE_ENV !== 'production' ? { stack: error.stack } : {})
    };

    if (error.statusCode === 500) {
        logger.error(`[${req.method}] ${req.url} >> StatusCode:: ${error.statusCode}, Message:: ${error.message}\n${error.stack}`);
    } else {
        logger.warn(`[${req.method}] ${req.url} >> StatusCode:: ${error.statusCode}, Message:: ${error.message}`);
    }

    res.status(error.statusCode).json(response);
};

module.exports = errorHandler;