const nodemailer = require('nodemailer');

/**
 * Centralized Nodemailer Transporter Configuration
 * This transporter is used across the entire application for sending emails
 */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.APP_PASSWORD
    }
});

// Verify transporter configuration on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

module.exports = transporter;
