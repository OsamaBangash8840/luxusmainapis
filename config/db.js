const mongoose = require('mongoose');

const logger = require('../utils/logger');

const connectDB = async (retries = 5, delay = 5000) => {
  while (retries > 0) {
    try {
      mongoose.set('sanitizeFilter', true);
      await mongoose.connect(process.env.MONGO_URI);
      logger.info('MongoDB Connected');
      return;
    } catch (error) {
      logger.error(`MongoDB Connection Error: ${error.message}`);
      retries -= 1;
      logger.info(`Retries left: ${retries}`);
      if (retries === 0) {
        logger.error('Failed to connect to MongoDB after multiple retries. Exiting...');
        throw new Error('Failed to connect to MongoDB after multiple retries.');
      }
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

module.exports = connectDB;
