const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { STATUS_CODES, PREMIUM_TOUR_PRICE_CENTS } = require('../config/constants');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.createPaymentIntent = asyncHandler(async (req, res) => {
    const { propertyId } = req.body;
    
    if (!propertyId) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Property ID is required");
    }

    const amount = PREMIUM_TOUR_PRICE_CENTS;

    const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        metadata: { propertyId, userId: req.user?.id },
        automatic_payment_methods: { enabled: true },
    });

    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
    }, "Payment Intent Created"));
});
