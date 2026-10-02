const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const { Property } = require('../models/Property');
const jwt = require('jsonwebtoken');

describe('Seller Endpoints', () => {
    let sellerToken, seller;

    beforeEach(async () => {
        seller = await User.create({ username: 'seller1', email: 's1@t.com', password: 'Password123', role: 'seller', isVerified: true });
        sellerToken = jwt.sign({ id: seller._id, role: seller.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
    });

    it('should get seller stats', async () => {
        await Property.create({
            title: 'Prop 1',
            description: 'Desc 1',
            price: 100,
            seller: seller._id,
            status: 'approved',
            category: new mongoose.Types.ObjectId(),
            location: { type: 'Point', coordinates: [0, 0] },
            views: 5
        });

        const res = await request(app)
            .get('/api/seller/stats')
            .set('Cookie', [`token=${sellerToken}`]);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.listingCounts.approved).toBe(1);
        expect(res.body.data.totalViews).toBe(5);
        expect(res.body.data.toursBooked).toBe(0);
        expect(res.body.data.openOffers).toBe(0);
    });
});
