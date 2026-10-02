const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const { MESSAGES } = require('../config/constants');
const ApiError = require('./ApiError');

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Ensure uploads/temp directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new ApiError(400, MESSAGES.UPLOAD.INVALID_FILE_TYPE), false);
    }
};

// Multer upload configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

/**
 * Upload a file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} folder - Cloudinary folder name (default: 'luxus-properties')
 * @returns {Promise<string>} - Cloudinary secure URL
 */
const uploadToCloudinary = async (filePath, folder = 'luxus-properties') => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            resource_type: 'auto',
        });

        // Delete the local file after successful upload
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload failed:', error);

        // Clean up local file on error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        throw new ApiError(500, MESSAGES.UPLOAD.FAILED);
    }
};

/**
 * Upload multiple files to Cloudinary
 * @param {Array} files - Array of file objects with path property
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<Array<string>>} - Array of Cloudinary URLs
 */
const uploadMultipleToCloudinary = async (files, folder = 'luxus-properties') => {
    try {
        const uploadPromises = files.map(file => uploadToCloudinary(file.path, folder));
        return await Promise.all(uploadPromises);
    } catch (error) {
        throw new ApiError(500, MESSAGES.UPLOAD.FAILED);
    }
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<void>}
 */
const deleteFromCloudinary = async (publicId) => {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Cloudinary delete failed:', error);
        throw new ApiError(500, 'Failed to delete file from cloud storage');
    }
};

module.exports = {
    upload,
    uploadToCloudinary,
    uploadMultipleToCloudinary,
    deleteFromCloudinary,
};
