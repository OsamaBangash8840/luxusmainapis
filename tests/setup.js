const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const nodemailer = require('nodemailer');

jest.setTimeout(60000);

jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue(true),
        verify: jest.fn().mockResolvedValue(true),
    })
}));

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGO_URI = uri;
    process.env.TOKEN_SECRET = 'test-secret';
    process.env.VERIFICATION_SECRET = 'test-secret';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.EMAIL = 'test@example.com';
    process.env.APP_PASSWORD = 'test';
    process.env.GOOGLE_SIGNUP_SECRET = 'google-secret';

    await mongoose.disconnect();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
});
