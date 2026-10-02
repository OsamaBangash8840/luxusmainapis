const Tour = require('../models/Tour');
const { Property } = require('../models/Property');
const mongoose = require('mongoose');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const sendEmail = require('../utils/email');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { MESSAGES, STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');

const TIME_ZONE = 'Asia/Dubai';



module.exports.scheduleTour = asyncHandler(async (req, res) => {
    const { propertyId, name, email, phone, date, message, time, isPremium, paymentIntentId } = req.body;

    if (!propertyId || !name || !email || !phone || !date || !time) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "All fields are required");
    }

    if (isPremium) {
        if (!paymentIntentId) {
            throw new ApiError(STATUS_CODES.BAD_REQUEST, "Payment ID required for premium tours");
        }
        
        // Verify PaymentIntent
        const Stripe = require('stripe');
        const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
        const { PREMIUM_TOUR_PRICE_CENTS } = require('../config/constants');
        
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            throw new ApiError(STATUS_CODES.BAD_REQUEST, "Payment not successful");
        }
        if (paymentIntent.amount !== PREMIUM_TOUR_PRICE_CENTS || paymentIntent.currency !== 'usd') {
            throw new ApiError(STATUS_CODES.BAD_REQUEST, "Invalid payment amount or currency");
        }
        if (paymentIntent.metadata.propertyId !== propertyId) {
            throw new ApiError(STATUS_CODES.BAD_REQUEST, "Payment property ID mismatch");
        }
    }

    const bookingDateTimeLocal = new Date(`${date}T${time}:00.000Z`);

    const bookingHour = bookingDateTimeLocal.getHours();

    const startHour = 9;
    const endHour = 18;
    const slotDuration = 30 * 60 * 1000;

    if (bookingHour < startHour || bookingHour > endHour) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, MESSAGES.TOUR.SLOT_NOT_AVAILABLE);
    }

    const endTime = new Date(bookingDateTimeLocal.getTime() + slotDuration);

    const existingBooking = await Tour.findOne({
        propertyId,
        status: mongoose.trusted({ $ne: 'cancelled' }),
        startTime: mongoose.trusted({ $lt: endTime }),
        endTime: mongoose.trusted({ $gt: bookingDateTimeLocal })
    });

    if (existingBooking) {
        throw new ApiError(STATUS_CODES.CONFLICT, MESSAGES.TOUR.SLOT_NOT_AVAILABLE);
    }

    const property = await Property.findById(propertyId).populate('seller', 'email');

    if (!property || !property.seller) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.PROPERTY.NOT_FOUND);
    }

    const ownerEmail = property.seller.email;

    if (!ownerEmail) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Owner email not found");
    }

    const tour = new Tour({
        propertyId,
        name,
        email,
        phone,
        date: bookingDateTimeLocal,
        startTime: bookingDateTimeLocal,
        endTime,
        message,
        isPremium: !!isPremium,
        paymentStatus: isPremium ? 'completed' : 'not_applicable',
        paymentIntentId,
        ...(req.user && req.user.id ? { userId: req.user.id } : {})
    });

    await tour.save();

    const emailText = `Dear ${name},\n\nYour tour has been scheduled for ${bookingDateTimeLocal.toLocaleString('en-US', { timeZone: TIME_ZONE })}.\n\nBest regards,\nLuxus Real Estate`;
    const ownerEmailText = `Dear Owner,\n\nA new tour has been scheduled for your property.\n\n- Buyer: ${name}\n- Date: ${bookingDateTimeLocal.toLocaleString()}\n- Message: ${message}\n\nPlease prepare accordingly.\n\nBest regards,\nLuxus Real Estate`;

    await sendEmail({
        to: ownerEmail,
        subject: 'New Tour Scheduled for Your Property',
        text: ownerEmailText,
    });

    await sendEmail({
        to: email,
        subject: 'Tour Confirmation',
        text: emailText,
    });

    logger.info('Tour scheduled', { tourId: tour._id, propertyId, buyerEmail: email });
    return res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, tour, MESSAGES.TOUR.SCHEDULE_SUCCESS));
});


module.exports.availableSlots = asyncHandler(async (req, res) => {
    const { date, propertyId } = req.query;

    if (!propertyId || !date) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Property ID and date are required");
    }

    const bookingDate = new Date(date);
    if (isNaN(bookingDate)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Invalid date format");
    }

    const startHour = 9;
    const endHour = 18;
    const slotDuration = 30 * 60 * 1000;
    const availableSlots = [];

    for (let hour = startHour; hour < endHour; hour++) {
        for (let minutes = 0; minutes < 60; minutes += 30) {
            const slotStart = new Date(bookingDate);
            slotStart.setHours(hour, minutes, 0, 0);
            const slotEnd = new Date(slotStart.getTime() + slotDuration);

            const existingBooking = await Tour.findOne({
                propertyId,
                status: mongoose.trusted({ $ne: 'cancelled' }),
                startTime: mongoose.trusted({ $lt: slotEnd }),
                endTime: mongoose.trusted({ $gt: slotStart }),
            });

            if (!existingBooking) {
                availableSlots.push({
                    start: slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    end: slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                });
            }
        }
    }

    return res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, { availableSlots }, 'Available slots fetched successfully'));
});

module.exports.cancelTour = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const tour = await Tour.findById(id);

    if (!tour) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, 'Tour not found');
    }

    // Optional: add authorization check to ensure req.user.id is the tour owner (or admin)
    // Assuming req.user is available via a middleware:
    if (tour.userId && req.user && tour.userId.toString() !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(STATUS_CODES.FORBIDDEN, 'Not authorized to cancel this tour');
    }

    if (tour.status === 'cancelled') {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Tour is already cancelled');
    }

    const now = new Date();
    const tourTime = new Date(tour.startTime);
    const hoursDifference = (tourTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (tour.isPremium && tour.paymentStatus === 'completed' && tour.paymentIntentId) {
        if (hoursDifference > 24) {
            // Process Stripe refund
            try {
                await stripe.refunds.create({
                    payment_intent: tour.paymentIntentId,
                });
                tour.paymentStatus = 'refunded';
            } catch (error) {
                throw new ApiError(STATUS_CODES.INTERNAL_ERROR, 'Refund failed: ' + error.message);
            }
        } else {
            // Less than 24 hours, no refund
        }
    }

    tour.status = 'cancelled';
    await tour.save();

    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, 'Tour cancelled successfully'));
});