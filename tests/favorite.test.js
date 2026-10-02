const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const { Property } = require('../models/Property');
const Favorite = require('../models/Favorite');
const jwt = require('jsonwebtoken');

describe('Favorites Endpoints', () => {
    let buyerToken, buyer;
    let sellerToken, seller;
    let propertyId;

    beforeEach(async () => {
        buyer = await User.create({ username: 'buyer1', email: 'b1@t.com', password: 'Password123', role: 'buyer', isVerified: true });
        seller = await User.create({ username: 'seller1', email: 's1@t.com', password: 'Password123', role: 'seller', isVerified: true });
        
        buyerToken = jwt.sign({ id: buyer._id, role: buyer.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
        sellerToken = jwt.sign({ id: seller._id, role: seller.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });

        const prop = await Property.create({
            title: 'Prop 1',
            description: 'Desc 1',
            price: 100,
            seller: seller._id,
            status: 'approved',
            category: new mongoose.Types.ObjectId(),
            location: { type: 'Point', coordinates: [0, 0] }
        });
        propertyId = prop._id;
    });

    it('should add a property to favorites', async () => {
        const res = await request(app)
            .post(`/api/favorites/${propertyId}`)
            .set('Cookie', [`token=${buyerToken}`]);
            
        expect(res.statusCode).toBe(201);
        expect(res.body.message).toBe('Property added to favorites');

        const fav = await Favorite.findOne({ userId: buyer._id, propertyId });
        expect(fav).not.toBeNull();
    });

    it('should not add a non-existent or unapproved property to favorites', async () => {
        const prop2 = await Property.create({
            title: 'Prop 2',
            description: 'Desc 2',
            price: 100,
            seller: seller._id,
            status: 'pending',
            category: new mongoose.Types.ObjectId(),
            location: { type: 'Point', coordinates: [0, 0] }
        });

        const res = await request(app)
            .post(`/api/favorites/${prop2._id}`)
            .set('Cookie', [`token=${buyerToken}`]);
            
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe('Property not found');
    });

    it('should not add a property to favorites twice', async () => {
        await Favorite.create({ userId: buyer._id, propertyId });

        const res = await request(app)
            .post(`/api/favorites/${propertyId}`)
            .set('Cookie', [`token=${buyerToken}`]);
            
        expect(res.statusCode).toBe(409);
        expect(res.body.message).toBe('Property already in favorites');
    });

    it('should remove a property from favorites', async () => {
        await Favorite.create({ userId: buyer._id, propertyId });

        const res = await request(app)
            .delete(`/api/favorites/${propertyId}`)
            .set('Cookie', [`token=${buyerToken}`]);
            
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Property removed from favorites');

        const fav = await Favorite.findOne({ userId: buyer._id, propertyId });
        expect(fav).toBeNull();
    });

    it('should get all favorites for a user', async () => {
        await Favorite.create({ userId: buyer._id, propertyId });

        const res = await request(app)
            .get('/api/favorites')
            .set('Cookie', [`token=${buyerToken}`]);
            
        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].propertyId._id.toString()).toBe(propertyId.toString());
        expect(res.body.data[0].propertyId.title).toBe('Prop 1');
    });
});
