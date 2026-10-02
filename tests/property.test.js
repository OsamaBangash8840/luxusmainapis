const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { Property } = require('../models/Property');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

describe('Property Endpoints', () => {
    let seller1Token, seller2Token, adminToken;
    let seller1, seller2, admin;

    beforeEach(async () => {
        seller1 = await User.create({ username: 's1', email: 's1@t.com', password: 'Password123', role: 'seller', isVerified: true });
        seller2 = await User.create({ username: 's2', email: 's2@t.com', password: 'Password123', role: 'seller', isVerified: true });
        admin = await User.create({ username: 'a', email: 'a@t.com', password: 'Password123', role: 'admin', isVerified: true });

        seller1Token = jwt.sign({ id: seller1._id, role: seller1.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
        seller2Token = jwt.sign({ id: seller2._id, role: seller2.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
        adminToken = jwt.sign({ id: admin._id, role: admin.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
    });

    it('a seller cannot update another sellers property', async () => {
        const prop = await Property.create({
            title: 'Prop 1',
            description: 'Desc 1',
            price: 100,
            seller: seller1._id,
            status: 'approved',
            category: new mongoose.Types.ObjectId(),
            location: { type: 'Point', coordinates: [0, 0] }
        });

        const res = await request(app)
            .put(`/api/properties/${prop._id}`)
            .set('Cookie', [`token=${seller2Token}`])
            .send({ title: 'Hacked' });

        expect(res.statusCode).toBe(403);
    });

    it('a seller cannot set status approved', async () => {
        const prop = await Property.create({
            title: 'Prop 1',
            description: 'Desc 1',
            price: 100,
            seller: seller1._id,
            status: 'pending',
            category: new mongoose.Types.ObjectId(),
            location: { type: 'Point', coordinates: [0, 0] }
        });

        const res = await request(app)
            .put(`/api/properties/${prop._id}`)
            .set('Cookie', [`token=${seller1Token}`])
            .send({ status: 'approved' });

        expect(res.statusCode).toBe(200);
        const updated = await Property.findById(prop._id);
        expect(updated.status).toBe('pending');
    });

    it('public listing endpoints never return pending/rejected properties', async () => {
        await Property.create({ title: 'Approved', description: 'Desc', price: 100, seller: seller1._id, status: 'approved', category: new mongoose.Types.ObjectId(), location: { type: 'Point', coordinates: [0, 0] } });
        await Property.create({ title: 'Pending', description: 'Desc', price: 100, seller: seller1._id, status: 'pending', category: new mongoose.Types.ObjectId(), location: { type: 'Point', coordinates: [0, 0] } });

        const res = await request(app).get('/api/properties');
        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].title).toBe('Approved');
    });

    it('search with regex special characters does not crash', async () => {
        const res = await request(app).get('/api/properties/search?search=(a+)+$');
        expect(res.statusCode).toBe(200); // Should return empty but not crash
    });
});
