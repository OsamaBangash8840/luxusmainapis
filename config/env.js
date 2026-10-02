const logger = require('../utils/logger');

const required = ['MONGO_URI', 'TOKEN_SECRET', 'FRONTEND_URL', 'EMAIL', 'APP_PASSWORD'];
const optionalWithWarnings = [
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'
];

// Handle VERIFICATION_SECRECT typo migration
if (process.env.VERIFICATION_SECRECT && !process.env.VERIFICATION_SECRET) {
    logger.warn('DEPRECATION WARNING: VERIFICATION_SECRECT is misspelled. Please rename it to VERIFICATION_SECRET in your .env file.');
    process.env.VERIFICATION_SECRET = process.env.VERIFICATION_SECRECT;
}

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
    logger.error(`FATAL ERROR: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

optionalWithWarnings.forEach(key => {
    if (!process.env[key]) {
        logger.warn(`Missing optional environment variable: ${key}. Some features may not work properly.`);
    }
});

module.exports = {
    MONGO_URI: process.env.MONGO_URI,
    TOKEN_SECRET: process.env.TOKEN_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL,
    EMAIL: process.env.EMAIL,
    APP_PASSWORD: process.env.APP_PASSWORD,
    VERIFICATION_SECRET: process.env.VERIFICATION_SECRET || process.env.TOKEN_SECRET, // Fallback if missing
    PORT: process.env.PORT || 8000,
    NODE_ENV: process.env.NODE_ENV || 'development'
};
