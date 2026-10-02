const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');

describe('Admin User Management Endpoints', () => {
    let adminToken, admin, buyerToken, buyer;

    beforeEach(async () => {
        admin = await User.create({ username: 'admin1', email: 'a1@t.com', password: 'Password123', role: 'admin', isVerified: true });
        buyer = await User.create({ username: 'buyer1', email: 'b1@t.com', password: 'Password123', role: 'buyer', isVerified: true });
        
        adminToken = jwt.sign({ id: admin._id, role: admin.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
        buyerToken = jwt.sign({ id: buyer._id, role: buyer.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
    });

    it('admin can get users paginated', async () => {
        const res = await request(app)
            .get('/api/admin/users?role=buyer&limit=1')
            .set('Cookie', [`token=${adminToken}`]);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.users.length).toBe(1);
        expect(res.body.data.pagination.total).toBe(1);
    });

    it('admin can ban a user and it creates an audit log', async () => {
        const res = await request(app)
            .patch(`/api/admin/users/${buyer._id}/ban`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ isBanned: true });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.isBanned).toBe(true);

        const updatedBuyer = await User.findById(buyer._id);
        expect(updatedBuyer.isBanned).toBe(true);

        const log = await AuditLog.findOne({ targetId: buyer._id });
        expect(log).not.toBeNull();
        expect(log.action).toBe('ban_user');
        expect(log.adminId.toString()).toBe(admin._id.toString());
    });

    it('admin cannot ban another admin', async () => {
        const res = await request(app)
            .patch(`/api/admin/users/${admin._id}/ban`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ isBanned: true });

        expect(res.statusCode).toBe(403);
    });
});
