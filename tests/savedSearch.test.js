const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const SavedSearch = require('../models/SavedSearch');
const jwt = require('jsonwebtoken');

describe('Saved Searches Endpoints', () => {
    let buyerToken, buyer;

    beforeEach(async () => {
        buyer = await User.create({ username: 'buyer1', email: 'b1@t.com', password: 'Password123', role: 'buyer', isVerified: true });
        buyerToken = jwt.sign({ id: buyer._id, role: buyer.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
    });

    it('should create a saved search', async () => {
        const res = await request(app)
            .post('/api/saved-searches')
            .set('Cookie', [`token=${buyerToken}`])
            .send({
                name: 'My Search',
                filters: { search: 'Villa', minPrice: 1000 }
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.name).toBe('My Search');
        expect(res.body.data.filters.search).toBe('Villa');
    });

    it('should get saved searches', async () => {
        await SavedSearch.create({ userId: buyer._id, name: 'Search 1' });
        await SavedSearch.create({ userId: buyer._id, name: 'Search 2' });

        const res = await request(app)
            .get('/api/saved-searches')
            .set('Cookie', [`token=${buyerToken}`]);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(2);
    });

    it('should delete a saved search', async () => {
        const search = await SavedSearch.create({ userId: buyer._id, name: 'To Delete' });

        const res = await request(app)
            .delete(`/api/saved-searches/${search._id}`)
            .set('Cookie', [`token=${buyerToken}`]);

        expect(res.statusCode).toBe(200);

        const check = await SavedSearch.findById(search._id);
        expect(check).toBeNull();
    });
});
