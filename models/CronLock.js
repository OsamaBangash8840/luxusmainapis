const mongoose = require('mongoose');

const CronLockSchema = new mongoose.Schema({
    jobName: { type: String, required: true, unique: true },
    lockedUntil: { type: Date, required: true },
    lockedBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('CronLock', CronLockSchema);
