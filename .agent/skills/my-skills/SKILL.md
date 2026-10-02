# SKILLS.md - Luxus Real Estate Backend

## 📁 Project Structure Overview

This project follows the **MVC (Model-View-Controller)** architecture pattern with additional layers for better separation of concerns.

```
backend/
├── config/
│   ├── constants.js          # All constant values and messages
│   ├── db.js                 # Database connection
│   └── env.js                # Environment variables
│
├── controllers/              # Request handlers (Controller)
│   ├── auth.controller.js
│   ├── property.controller.js
│   ├── cart.controller.js
│   ├── admin.controller.js
│   └── ...
│
├── models/                   # Database schemas (Model)
│   ├── User.js
│   ├── Property.js
│   ├── Cart.js
│   └── ...
│
├── routes/                   # API routes (Router)
│   ├── auth.routes.js
│   ├── property.routes.js
│   ├── cart.routes.js
│   └── ...
│
├── middlewares/              # Custom middleware
│   ├── verifyToken.js
│   ├── adminAuth.js
│   ├── errorHandler.js
│   └── upload.js
│
├── utils/                    # Utility functions
│   ├── ApiError.js           # Custom error class
│   ├── ApiResponse.js        # Standard response format
│   ├── asyncHandler.js       # Async error wrapper
│   ├── email.js              # Email sending utility
│   ├── validation.js         # Input validation
│   └── logger.js             # Logging utility
│
├── services/                 # Business logic layer
│   ├── payment.service.js
│   ├── email.service.js
│   └── storage.service.js
│
├── app.js                    # Express app setup
├── server.js                 # Server entry point
└── package.json
```

---

## 🏗️ MVC Architecture Explained

### **Model (M)** - Data Layer
- Located in `models/` folder
- Defines database schemas using Mongoose
- Handles data validation and relationships
- Example: `User.js`, `Property.js`, `Cart.js`

**Example:**
```javascript
// models/Property.js
const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
```

### **Controller (C)** - Business Logic Layer
- Located in `controllers/` folder
- Handles incoming requests
- Processes data and calls models
- Returns responses using `ApiResponse`
- Uses `asyncHandler` to catch errors

**Example:**
```javascript
// controllers/property.controller.js
const getProperties = asyncHandler(async (req, res) => {
  const properties = await Property.find({ status: 'approved' });
  return res.status(200).json(
    new ApiResponse(200, properties, MESSAGES.PROPERTY.FETCH_SUCCESS)
  );
});
```

### **Routes (Router)** - Routing Layer
- Located in `routes/` folder
- Defines API endpoints
- Maps URLs to controller functions
- Applies middleware (auth, validation)

**Example:**
```javascript
// routes/property.routes.js
router.get('/properties', getProperties);
router.post('/properties', verifyToken, addProperty);
```

---

## 🛠️ Utility Files Explained

### 1. **utils/ApiError.js**
Custom error class for consistent error handling.

**Purpose:**
- Standardize error format across the app
- Include status code, message, and errors
- Extend native Error class

**Usage:**
```javascript
throw new ApiError(404, MESSAGES.PROPERTY.NOT_FOUND);
throw new ApiError(400, MESSAGES.VALIDATION.INVALID_INPUT, errors);
```

**Implementation:**
```javascript
class ApiError extends Error {
  constructor(
    statusCode,
    message = MESSAGES.ERROR.SOMETHING_WENT_WRONG,
    errors = [],
    stack = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
```

---

### 2. **utils/ApiResponse.js**
Standard response format for successful operations.

**Purpose:**
- Consistent response structure
- Include status code, data, and message
- Make frontend parsing easier

**Usage:**
```javascript
return res.status(200).json(
  new ApiResponse(200, data, MESSAGES.SUCCESS.OPERATION_SUCCESSFUL)
);
```

**Implementation:**
```javascript
class ApiResponse {
  constructor(statusCode, data, message = MESSAGES.SUCCESS.DEFAULT) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}
```

**Response Format:**
```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "Properties fetched successfully",
  "success": true
}
```

---

### 3. **utils/asyncHandler.js**
Wrapper to handle async errors in Express routes.

**Purpose:**
- Eliminate try-catch blocks in controllers
- Automatically catch and forward errors
- Cleaner controller code

**Usage:**
```javascript
const getProperties = asyncHandler(async (req, res) => {
  // No need for try-catch
  const properties = await Property.find();
  res.json(new ApiResponse(200, properties));
});
```

**Implementation:**
```javascript
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

**Before asyncHandler:**
```javascript
const getProperties = async (req, res) => {
  try {
    const properties = await Property.find();
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

**After asyncHandler:**
```javascript
const getProperties = asyncHandler(async (req, res) => {
  const properties = await Property.find();
  res.json(new ApiResponse(200, properties));
});
```

---

### 4. **utils/email.js**
Email sending utility using Nodemailer.

**Purpose:**
- Send transactional emails
- Email templates for different scenarios
- Centralized email configuration

**Usage:**
```javascript
await sendEmail({
  to: user.email,
  subject: MESSAGES.EMAIL.VERIFICATION_SUBJECT,
  html: emailTemplate('verification', { code: '123456' })
});
```

**Implementation:**
```javascript
const nodemailer = require('nodemailer');
const { EMAIL } = require('../config/constants');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.APP_PASSWORD,
  },
});

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const mailOptions = {
      from: {
        name: EMAIL.FROM_NAME,
        address: process.env.EMAIL,
      },
      to,
      subject,
      html,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new ApiError(500, MESSAGES.EMAIL.SEND_FAILED);
  }
};

module.exports = { sendEmail };
```

---

### 5. **utils/validation.js** (New)
Input validation helpers using express-validator.

**Purpose:**
- Validate request data
- Reusable validation rules
- Consistent error messages

**Usage:**
```javascript
router.post('/register', validateRegistration, register);
```

**Implementation:**
```javascript
const { body, validationResult } = require('express-validator');
const { MESSAGES } = require('../config/constants');
const { ApiError } = require('./ApiError');

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

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, MESSAGES.VALIDATION.FAILED, errors.array());
  }
  next();
};

module.exports = { validateRegistration, handleValidationErrors };
```

---

### 6. **utils/logger.js** (New)
Logging utility for debugging and monitoring.

**Purpose:**
- Structured logging
- Different log levels (info, warn, error)
- File and console logging

**Usage:**
```javascript
logger.info('User registered successfully', { userId: user._id });
logger.error('Payment failed', { error: err.message });
```

**Implementation:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

module.exports = logger;
```

---

### 7. **utils/fileUpload.js** (New)
File upload handling with Multer and Cloudinary.

**Purpose:**
- Handle property image uploads
- Validate file types and sizes
- Upload to cloud storage

**Usage:**
```javascript
router.post('/properties', upload.array('images', 10), addProperty);
```

**Implementation:**
```javascript
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { MESSAGES } = require('../config/constants');
const { ApiError } = require('./ApiError');

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new ApiError(400, MESSAGES.UPLOAD.INVALID_FILE_TYPE), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'luxus-properties',
    });
    return result.secure_url;
  } catch (error) {
    throw new ApiError(500, MESSAGES.UPLOAD.FAILED);
  }
};

module.exports = { upload, uploadToCloudinary };
```

---

## 📋 config/constants.js

Centralized location for all constant values and messages.

```javascript
// config/constants.js

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

module.exports = {
  MESSAGES,
  STATUS_CODES,
  ROLES,
  PROPERTY_STATUS,
  BOOKING_TYPES,
};
```

---

## 🎯 Usage Examples

### Controller Example
```javascript
// controllers/property.controller.js
const { Property } = require('../models/Property');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/ApiResponse');
const { ApiError } = require('../utils/ApiError');
const { MESSAGES, STATUS_CODES } = require('../config/constants');

const getProperties = asyncHandler(async (req, res) => {
  const properties = await Property.find({ status: 'approved' });
  
  return res.status(STATUS_CODES.OK).json(
    new ApiResponse(STATUS_CODES.OK, properties, MESSAGES.PROPERTY.FETCH_SUCCESS)
  );
});

const addProperty = asyncHandler(async (req, res) => {
  const property = await Property.create(req.body);
  
  return res.status(STATUS_CODES.CREATED).json(
    new ApiResponse(STATUS_CODES.CREATED, property, MESSAGES.PROPERTY.CREATE_SUCCESS)
  );
});

const deleteProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  
  if (!property) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.PROPERTY.NOT_FOUND);
  }
  
  await property.remove();
  
  return res.status(STATUS_CODES.OK).json(
    new ApiResponse(STATUS_CODES.OK, null, MESSAGES.PROPERTY.DELETE_SUCCESS)
  );
});

module.exports = { getProperties, addProperty, deleteProperty };
```

---

## ✨ Benefits of This Structure

1. **Consistency**: All responses and errors follow the same format
2. **Maintainability**: Change messages in one place (constants.js)
3. **Readability**: Controllers are clean without try-catch blocks
4. **Scalability**: Easy to add new utilities and constants
5. **Error Handling**: Centralized error handling with ApiError
6. **Type Safety**: Clear structure for request/response
7. **Testability**: Utilities are easy to unit test

---

## 🔧 Additional Utilities to Consider

```
utils/
├── dateHelper.js         # Date formatting and manipulation
├── pagination.js         # Pagination helper
├── slugify.js           # Generate URL-friendly slugs
├── imageCompression.js  # Compress images before upload
└── notification.js      # Push notification handling
```

---

## 📝 Summary

This structure provides:
- ✅ Clean separation of concerns (MVC)
- ✅ Reusable utility functions
- ✅ Centralized constants and messages
- ✅ Consistent error handling
- ✅ Standard response format
- ✅ Easy maintenance and scalability