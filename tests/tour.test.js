const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { Property } = require('../models/Property');
const Tour = require('../models/Tour');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Mock Stripe
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        paymentIntents: {
            retrieve: jest.fn().mockImplementation(async (id) => {
                if (id === 'pi_success') {
                    return { status: 'succeeded', amount: 5000, currency: 'usd', metadata: { propertyId: 'prop_id_1' } };
                } else if (id === 'pi_failed') {
                    return { status: 'requires_payment_method', amount: 5000, currency: 'usd', metadata: { propertyId: 'prop_id_1' } };
                }
            })
        }
    }));
});

describe('Tour Endpoints', () => {
    let buyerToken;
    let seller, buyer, property;

    beforeEach(async () => {
        seller = await User.create({ username: 's', email: 's@t.com', password: 'Password123', role: 'seller', isVerified: true });
        buyer = await User.create({ username: 'b', email: 'b@t.com', password: 'Password123', role: 'buyer', isVerified: true });
        buyerToken = jwt.sign({ id: buyer._id, role: buyer.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });

        property = await Property.create({
            _id: '123456789012345678901234',
            title: 'Prop 1',
            description: 'Desc 1',
            price: 100,
            seller: seller._id,
            status: 'approved',
            category: new mongoose.Types.ObjectId(),
            location: { type: 'Point', coordinates: [0, 0] }
        });
    });

    it('premium tour is rejected when PaymentIntent is not succeeded', async () => {
        const res = await request(app)
            .post('/api/schedule-tour')
            .set('Cookie', [`token=${buyerToken}`])
            .send({
                propertyId: property._id,
                name: 'Buyer',
                email: 'b@t.com',
                phone: '123456',
                date: '2027-10-10',
                time: '10:00',
                isPremium: true,
                paymentIntentId: 'pi_failed'
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/not successful/i);
    });

    it('double-booking the same slot returns 409', async () => {
        // Create first tour via API
        await request(app)
            .post('/api/schedule-tour')
            .set('Cookie', [`token=${buyerToken}`])
            .send({
                propertyId: property._id,
                name: 'Buyer1',
                email: 'b1@t.com',
                phone: '123',
                date: '2027-10-10',
                time: '10:00',
                message: 'Hello'
            });

        const res = await request(app)
            .post('/api/schedule-tour')
            .set('Cookie', [`token=${buyerToken}`])
            .send({
                propertyId: property._id,
                name: 'Buyer2',
                email: 'b2@t.com',
                phone: '456',
                date: '2027-10-10',
                time: '10:00',
                message: 'Hello again'
            });

        expect(res.statusCode).toBe(409);
    });
});
