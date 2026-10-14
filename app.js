require('dotenv').config();
require('./config/env');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const tourRoutes = require('./routes/tourRoutes');
const reviewRoute = require('./routes/reviewsRoutes');
const contactForm = require('./routes/contactForm');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const savedSearchRoutes = require('./routes/savedSearchRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorhandler');
const passport = require('./routes/googleRoutes');

const app = express();

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Tour = require('./models/Tour');

app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        const status = event.type === 'payment_intent.succeeded' ? 'completed' : 'failed';

        try {
            await Tour.findOneAndUpdate(
                { paymentIntentId: paymentIntent.id },
                { paymentStatus: status }
            );
        } catch (err) {
            console.error('Webhook DB Error:', err);
        }
    }

    res.send();
});

const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, { stream: { write: (message) => logger.info(message.trim()) } }));

app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '100kb' }));



// Middleware
app.use(cookieParser())

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : [process.env.FRONTEND_URL];

app.use(cors({
    exposedHeaders: ['Content-Length', 'Authorization', 'token'],
    origin: allowedOrigins,
    credentials: true
}));

// Connect to database (tests use in-memory mongo from tests/setup.js)
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}


// Routes
app.use('/api', userRoutes);
app.use('/api', propertyRoutes);
app.use('/api', categoryRoutes);
app.use('/api', tourRoutes);
app.use('/api', reviewRoute);
app.use('/api', contactForm)
app.use('/api', paymentRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/favorites', favoriteRoutes);
app.use('/api/saved-searches', savedSearchRoutes);
app.use('/api/seller', sellerRoutes);
app.use(passport.initialize());

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        db: mongoose.connection.readyState
    });
});

app.get('/api/testing', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'testing success'
    });
});

const { upload, uploadMultipleToCloudinary } = require('./utils/fileUpload');
const verifyToken = require('./middlewares/verifyToken');

app.post('/api/upload', verifyToken, upload.array('files', 10), async (req, res) => {
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to upload files' });
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    try {
        const uploadedUrls = await uploadMultipleToCloudinary(req.files);
        const uploadedImageUrls = uploadedUrls.map(url => ({ imageUrl: url }));
        res.status(200).json(uploadedImageUrls);
    } catch (err) {
        console.error('Error processing files:', err);
        res.status(500).json({ error: 'Failed to process uploaded files' });
    }
});

const setupSwagger = require('./config/swagger');
setupSwagger(app);

// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Route not found'
    });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
