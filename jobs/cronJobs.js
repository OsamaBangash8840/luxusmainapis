const cron = require('node-cron');
const SavedSearch = require('../models/SavedSearch');
const Tour = require('../models/Tour');
const { Property } = require('../models/Property');
const User = require('../models/User');
const CronLock = require('../models/CronLock');
const sendEmail = require('../utils/email');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const os = require('os');

/**
 * Acquire a distributed lock via MongoDB to ensure scheduled jobs run on only one server in cluster/multi-server setups
 */
const acquireDistributedLock = async (jobName, leaseMs = 30 * 60 * 1000) => {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + leaseMs);
    const workerId = `${process.pid}-${os.hostname()}-${Date.now()}`;

    try {
        const lock = await CronLock.findOneAndUpdate(
            {
                jobName,
                $or: [
                    { lockedUntil: { $lte: now } },
                    { lockedUntil: { $exists: false } }
                ]
            },
            {
                $set: { jobName, lockedUntil, lockedBy: workerId }
            },
            { upsert: true, new: true }
        );
        return !!lock;
    } catch (err) {
        // E11000 duplicate key error means another server won the race
        return false;
    }
};

const initCronJobs = () => {
    // Run daily at 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        const hasLock = await acquireDistributedLock('saved_search_alerts', 30 * 60 * 1000);
        if (!hasLock) {
            logger.info('Saved search alerts: Another server holds the lock. Skipping execution on this instance.');
            return;
        }

        logger.info('Running saved search alerts cron job...');
        try {
            const searches = await SavedSearch.find({}).populate('userId', 'email username');
            
            for (const search of searches) {
                if (!search.userId) continue;

                // Build query based on filters
                const query = {
                    status: 'approved',
                    createdAt: mongoose.trusted({ $gt: search.lastAlertSentAt }) // only new properties since last alert
                };

                const f = search.filters || {};
                if (f.search) {
                    query.$or = [
                        { title: { $regex: f.search, $options: 'i' } },
                        { description: { $regex: f.search, $options: 'i' } }
                    ];
                }
                if (f.category) query.category = f.category;
                if (f.minPrice || f.maxPrice) {
                    query.price = {};
                    if (f.minPrice) query.price.$gte = f.minPrice;
                    if (f.maxPrice) query.price.$lte = f.maxPrice;
                    query.price = mongoose.trusted(query.price);
                }
                if (f.bedrooms) query.bedrooms = mongoose.trusted({ $gte: f.bedrooms });
                if (f.bathrooms) query.bathrooms = mongoose.trusted({ $gte: f.bathrooms });

                const newProperties = await Property.find(query).limit(10);

                if (newProperties.length > 0) {
                    // Send email
                    const propertyList = newProperties.map(p => `- ${p.title} ($${p.price})`).join('\n');
                    const message = `Hi ${search.userId.username},\n\nWe found ${newProperties.length} new properties matching your saved search "${search.name}":\n\n${propertyList}\n\nCheck them out on Luxus Real Estate!`;
                    
                    await sendEmail({
                        email: search.userId.email,
                        subject: `New properties found for your saved search: ${search.name}`,
                        message
                    });

                    // Update lastAlertSentAt
                    search.lastAlertSentAt = new Date();
                    await search.save();
                }
            }
            logger.info('Saved search alerts cron job completed.');
        } catch (error) {
            logger.error('Error running saved search alerts cron job:', error);
        }
    });

    // Tour Reminders: Run every hour
    cron.schedule('0 * * * *', async () => {
        const hasLock = await acquireDistributedLock('tour_reminders', 45 * 60 * 1000);
        if (!hasLock) {
            logger.info('Tour reminders: Another server holds the lock. Skipping execution on this instance.');
            return;
        }

        logger.info('Running tour reminders cron job...');
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            const upcomingTours = await Tour.find({
                status: 'scheduled',
                startTime: mongoose.trusted({
                    $gte: tomorrow,
                    $lt: new Date(tomorrow.getTime() + 60 * 60 * 1000)
                }),
                reminderSent: mongoose.trusted({ $ne: true })
            }).populate('propertyId');

            for (const tour of upcomingTours) {
                await sendEmail({
                    email: tour.email,
                    subject: `Reminder: Upcoming tour for ${tour.propertyId.title}`,
                    message: `Hi ${tour.name},\n\nThis is a reminder for your scheduled tour of ${tour.propertyId.title} on ${tour.date.toDateString()} at ${tour.startTime.toTimeString()}.\n\nSee you there!`
                });

                tour.reminderSent = true;
                await tour.save();
            }
            logger.info('Tour reminders cron job completed.');
        } catch (error) {
            logger.error('Error running tour reminders cron job:', error);
        }
    });
};

module.exports = initCronJobs;
