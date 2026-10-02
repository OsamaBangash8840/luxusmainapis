require('dotenv').config();
require('./config/env');
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { initializeSocket } = require('./socketConnection');
const logger = require('./utils/logger');
const initCronJobs = require('./jobs/cronJobs');

const PORT = process.env.PORT || 8000;

const server = http.createServer(app);
initializeSocket(server);

server.listen(PORT, () => {
    logger.info(`API IS RUNNING ON ${PORT}`);
    initCronJobs();
});

// Graceful Shutdown
const shutdown = () => {
    logger.info('SIGTERM/SIGINT received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            // eslint-disable-next-line n/no-process-exit
            process.exit(0);
        });
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    shutdown();
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    shutdown();
});

module.exports = server;
