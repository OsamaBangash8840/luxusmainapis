const winston = require('winston');
const path = require('path');

/**
 * Winston logger configuration for structured logging
 * Logs to files and console based on environment
 */
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'luxus-real-estate' },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write all logs to combined.log
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// If we're not in production, log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        })
    );
}

/**
 * Helper function to log HTTP requests
 */
logger.logRequest = (req, message = 'HTTP Request') => {
    logger.info(message, {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userId: req.user?._id,
    });
};

/**
 * Helper function to log errors with context
 */
logger.logError = (error, context = {}) => {
    logger.error(error.message, {
        stack: error.stack,
        ...context,
    });
};

module.exports = logger;
