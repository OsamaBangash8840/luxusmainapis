const { validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const Newsletter = require('../models/Newsletter');
const transporter = require('../config/emailTransporter');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');

module.exports.submitContactForm = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Validation failed', errors.array());
    }

    const { name, email, message, mobile } = req.body;

    const submission = new Contact({ name, email, message, mobile });
    await submission.save();

    const adminMailOptions = {
        to: process.env.EMAIL,
        from: {
            name: 'Luxus Real Estate',
            email: 'hello@luxusrealestate.com',
        },
        subject: 'Form Submission',
        text: `This Email is Sent by Luxus Real Estate\n\nYou have a new contact form submission:\n\nName: ${name}\nEmail: ${email}\nNumber: ${mobile}\nMessage: ${message}`,
    };

    const userMailOptions = {
        to: email,
        from: process.env.EMAIL,
        subject: 'Thank you for contacting us!',
        text: `Dear ${name},\n\nThank you for reaching out to us. We have received your message and will get back to you shortly.\n\nBest regards,\nLuxus Real Estate`,
    };

    await transporter.sendMail(adminMailOptions);
    await transporter.sendMail(userMailOptions);

    logger.info('Contact form submitted', { email });
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, 'Form Submitted'));
});

module.exports.subscribeNewsletter = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Invalid email address');
    }

    const existingSubscription = await Newsletter.findOne({ email });
    if (existingSubscription) {
        throw new ApiError(409, 'Email is already subscribed');
    }

    const newsletter = new Newsletter({ email });
    await newsletter.save();

    const adminMailOptions = {
        to: process.env.EMAIL,
        from: process.env.EMAIL,
        subject: 'New Newsletter Subscription',
        text: `You have a new subscription: ${email}`,
    };

    const userMailOptions = {
        to: email,
        from: process.env.EMAIL,
        subject: 'Thank You for Subscribing!',
        text: 'Thank you for subscribing to Luxus Real Estate.',
    };

    await transporter.sendMail(adminMailOptions);
    await transporter.sendMail(userMailOptions);

    logger.info('Newsletter subscribed', { email });
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, 'Subscription successful!'));
});
