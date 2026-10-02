const { body, validationResult } = require('express-validator');
const { MESSAGES } = require('../config/constants');
const ApiError = require('./ApiError');

/**
 * Validation rules for user registration
 */
const validateRegistration = [
    body('email')
        .isEmail()
        .withMessage(MESSAGES.VALIDATION.INVALID_EMAIL)
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage(MESSAGES.VALIDATION.PASSWORD_MIN_LENGTH)
        .matches(/^(?=.*[A-Z])(?=.*[0-9])/)
        .withMessage(MESSAGES.VALIDATION.PASSWORD_REQUIREMENTS),
    body('username')
        .isLength({ min: 3, max: 30 })
        .withMessage(MESSAGES.VALIDATION.USERNAME_LENGTH),
];

/**
 * Validation rules for login
 */
const validateLogin = [
    body('email')
        .isEmail()
        .withMessage(MESSAGES.VALIDATION.INVALID_EMAIL)
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage(MESSAGES.VALIDATION.REQUIRED_FIELD),
];

/**
 * Validation rules for property creation
 */
const validateProperty = [
    body('title')
        .notEmpty()
        .withMessage(MESSAGES.VALIDATION.REQUIRED_FIELD)
        .isLength({ min: 5, max: 200 })
        .withMessage('Title must be between 5 and 200 characters'),
    body('price')
        .isNumeric()
        .withMessage('Price must be a number')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    body('description')
        .notEmpty()
        .withMessage(MESSAGES.VALIDATION.REQUIRED_FIELD),
];

/**
 * Middleware to handle validation errors
 * Should be used after validation rules
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new ApiError(400, MESSAGES.VALIDATION.FAILED, errors.array());
    }
    next();
};

/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = (paramName = 'id') => {
    return [
        body(paramName)
            .matches(/^[0-9a-fA-F]{24}$/)
            .withMessage(MESSAGES.VALIDATION.INVALID_ID),
    ];
};

module.exports = {
    validateRegistration,
    validateLogin,
    validateProperty,
    handleValidationErrors,
    validateObjectId,
};
