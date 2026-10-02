// Comprehensive Messages Structure
const MESSAGES = {
    // Success Messages
    SUCCESS: {
        DEFAULT: 'Operation successful',
        OPERATION_SUCCESSFUL: 'Operation completed successfully',
    },

    // Authentication Messages
    AUTH: {
        REGISTER_SUCCESS: 'User registered successfully. Please verify your email.',
        LOGIN_SUCCESS: 'Login successful',
        LOGOUT_SUCCESS: 'Logged out successfully',
        EMAIL_VERIFIED: 'Email verified successfully',
        PASSWORD_RESET_SENT: 'Password reset link sent to your email',
        PASSWORD_RESET_SUCCESS: 'Password reset successfully',
        INVALID_CREDENTIALS: 'Invalid email or password',
        EMAIL_NOT_VERIFIED: 'Please verify your email before logging in',
        TOKEN_EXPIRED: 'Token has expired',
        UNAUTHORIZED: 'Unauthorized access',
        EMAIL_ALREADY_EXISTS: 'Email already registered',
        INVALID_TOKEN: 'Invalid or expired token',
    },

    // Property Messages
    PROPERTY: {
        CREATE_SUCCESS: 'Property created successfully',
        UPDATE_SUCCESS: 'Property updated successfully',
        DELETE_SUCCESS: 'Property deleted successfully',
        FETCH_SUCCESS: 'Properties fetched successfully',
        NOT_FOUND: 'Property not found',
        ALREADY_EXISTS: 'Property already exists',
        UNAUTHORIZED_UPDATE: 'You are not authorized to update this property',
        STATUS_UPDATED: 'Property status updated successfully',
    },

    // Cart Messages
    CART: {
        ADD_SUCCESS: 'Property added to cart',
        REMOVE_SUCCESS: 'Property removed from cart',
        FETCH_SUCCESS: 'Cart fetched successfully',
        ALREADY_IN_CART: 'Property already in cart',
        EMPTY_CART: 'Your cart is empty',
        CLEARED: 'Cart cleared successfully',
    },

    // Coupon Messages
    COUPON: {
        APPLY_SUCCESS: 'Coupon applied successfully',
        INVALID: 'Invalid or expired coupon code',
        ALREADY_USED: 'Coupon already used',
        NOT_APPLICABLE: 'Coupon not applicable to these items',
    },

    // Payment Messages
    PAYMENT: {
        SUCCESS: 'Payment processed successfully',
        FAILED: 'Payment failed. Please try again.',
        INTENT_CREATED: 'Payment intent created',
        INVALID_AMOUNT: 'Invalid payment amount',
    },

    // Admin Messages
    ADMIN: {
        PROPERTY_APPROVED: 'Property approved successfully',
        PROPERTY_REJECTED: 'Property rejected',
        ACCESS_DENIED: 'Admin access required',
        STATS_FETCHED: 'Dashboard statistics fetched successfully',
    },

    // User Messages
    USER: {
        PROFILE_UPDATED: 'Profile updated successfully',
        PROFILE_FETCH_SUCCESS: 'Profile fetched successfully',
        NOT_FOUND: 'User not found',
    },

    // Validation Messages
    VALIDATION: {
        INVALID_EMAIL: 'Please provide a valid email address',
        INVALID_PASSWORD: 'Password must be at least 8 characters',
        PASSWORD_MIN_LENGTH: 'Password must be at least 8 characters long',
        PASSWORD_REQUIREMENTS: 'Password must contain at least one uppercase letter and one number',
        USERNAME_LENGTH: 'Username must be between 3 and 30 characters',
        REQUIRED_FIELD: 'This field is required',
        INVALID_INPUT: 'Invalid input data',
        FAILED: 'Validation failed',
        INVALID_ID: 'Invalid ID format',
    },

    // Email Messages
    EMAIL: {
        VERIFICATION_SUBJECT: 'Verify your email - Luxus Real Estate',
        PASSWORD_RESET_SUBJECT: 'Password Reset Request - Luxus Real Estate',
        WELCOME_SUBJECT: 'Welcome to Luxus Real Estate',
        SEND_FAILED: 'Failed to send email. Please try again later.',
        FROM_NAME: 'Luxus Real Estate',
    },

    // Upload Messages
    UPLOAD: {
        SUCCESS: 'File uploaded successfully',
        FAILED: 'File upload failed',
        INVALID_FILE_TYPE: 'Invalid file type. Only images are allowed.',
        FILE_TOO_LARGE: 'File size exceeds the limit of 5MB',
    },

    // Error Messages
    ERROR: {
        SOMETHING_WENT_WRONG: 'Something went wrong. Please try again.',
        SERVER_ERROR: 'Internal server error',
        NOT_FOUND: 'Resource not found',
        BAD_REQUEST: 'Bad request',
        FORBIDDEN: 'Access forbidden',
        RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
    },

    // Chat Messages
    CHAT: {
        MESSAGE_SENT: 'Message sent successfully',
        CONVERSATION_FETCHED: 'Conversation fetched successfully',
        CONVERSATIONS_FETCHED: 'Conversations fetched successfully',
        MESSAGE_NOT_FOUND: 'Message not found',
    },

    // Review Messages
    REVIEW: {
        SUBMIT_SUCCESS: 'Review submitted successfully',
        UPDATE_SUCCESS: 'Review updated successfully',
        DELETE_SUCCESS: 'Review deleted successfully',
        FETCH_SUCCESS: 'Reviews fetched successfully',
        NOT_FOUND: 'Review not found',
    },

    // Tour Messages
    TOUR: {
        SCHEDULE_SUCCESS: 'Tour scheduled successfully',
        CANCEL_SUCCESS: 'Tour cancelled successfully',
        UPDATE_SUCCESS: 'Tour updated successfully',
        FETCH_SUCCESS: 'Tours fetched successfully',
        NOT_FOUND: 'Tour not found',
        SLOT_NOT_AVAILABLE: 'Selected time slot is not available',
    },
};

const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
};

const ROLES = {
    ADMIN: 'admin',
    SELLER: 'seller',
    BUYER: 'buyer',
};

const PROPERTY_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
};

const BOOKING_TYPES = {
    PURCHASE: 'purchase',
    RENT: 'rent',
    TOUR: 'tour',
};

const PREMIUM_TOUR_PRICE_CENTS = 5000;

// Legacy RESPONSE_MESSAGES for backward compatibility
const RESPONSE_MESSAGES = {
    ACCOUNT_NOT_FOUND: 'Account not found',
    INVALID_PASSWORD: 'Invalid password',
    REQUIRED_FIELDS_EMPTY: 'Required fields cannot be empty',
    EMAIL_ALREADY_EXISTS: 'Email already exists',
    USER_NOT_FOUND: 'User not found',
    CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
    PASSWORD_UPDATED_SUCCESSFULLY: 'Password updated successfully',
    EMAIL_REQUIRED: 'Email is required',
    PASSWORD_RESET_TOKEN_SENT: 'Password reset token sent to email',
    INVALID_RESET_TOKEN: 'Invalid reset token',
    PASSWORD_RESET_SUCCESSFULLY: 'Password reset successfully',
    ACCOUNT_CREATED_SUCCESSFULLY: 'Account created successfully',
    RESET_TOKEN_AND_NEW_PASSWORD_REQUIRED: 'Reset token and new password are required',
    CURRENT_AND_NEW_PASSWORD_REQUIRED: 'Current and new password are required',
    SERVER_ERROR: 'An unexpected server error occurred',
    AUTH_TOKEN_REQUIRED: 'Auth token required',
    INVALID_AUTH_TOKEN: 'Invalid auth token',
    USER_DEACTIVATED: 'Account Deactivated',
    USER_DEACTIVATED_MESSAGE: 'Your account is deactivated please contact with support',
    USER_FREEZED: 'Account Freezed',
};

module.exports = {
    MESSAGES,
    STATUS_CODES,
    ROLES,
    PROPERTY_STATUS,
    BOOKING_TYPES,
    PREMIUM_TOUR_PRICE_CENTS,
    RESPONSE_MESSAGES, // Keep for backward compatibility
};