const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

describe('Auth Endpoints', () => {
    it('register cannot create an admin', async () => {
        const res = await request(app).post('/api/register').send({
            username: 'testadmin',
            email: 'admin@test.com',
            password: 'Password123',
            role: 'admin'
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/Invalid role/i);
    });

    it('profile update cannot change role', async () => {
        // Create user
        const user = await User.create({
            username: 'buyer1',
            email: 'buyer1@test.com',
            password: 'Password123',
            role: 'buyer',
            isVerified: true
        });

        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });

        const res = await request(app)
            .put('/api/profile')
            .set('Cookie', [`token=${token}`])
            .send({
                role: 'admin',
                username: 'buyer_updated'
            });

        expect(res.statusCode).toBe(200);
        
        const updatedUser = await User.findById(user._id);
        expect(updatedUser.role).toBe('buyer');
        expect(updatedUser.username).toBe('buyer_updated');
    });

    it('complete-google-signup rejects a missing/forged token', async () => {
        const resMissing = await request(app).post('/api/complete-google-signup').send({
            role: 'buyer',
            username: 'googleuser'
        });
        expect(resMissing.statusCode).toBe(400);

        const resForged = await request(app).post('/api/complete-google-signup').send({
            token: 'invalid.token.here',
            role: 'buyer',
            username: 'googleuser'
        });
        expect(resForged.statusCode).toBe(400);
    });

    it('the password reset token works once and then fails', async () => {
        const user = await User.create({
            username: 'resetuser',
            email: 'reset@test.com',
            password: 'Password123',
            role: 'buyer',
            isVerified: true
        });

        // Request reset
        await request(app).post('/api/forget-password').send({ email: 'reset@test.com' });

        const updatedUser = await User.findById(user._id).select('+resetPasswordToken');
        expect(updatedUser.resetPasswordToken).toBeDefined();

        // Normally we'd get the token from email. 
        // Wait, in Phase 1 I changed it to crypto.randomBytes(32).toString('hex').
        // But how do we test if we don't have the unhashed token?
        // Let's create the token manually.
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        user.resetPasswordToken = hash;
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
        await user.save();

        const res1 = await request(app)
            .post(`/api/reset-password/${resetToken}`)
            .send({ password: 'NewPassword123' });
        
        expect(res1.statusCode).toBe(200);

        // Try again
        const res2 = await request(app)
            .post(`/api/reset-password/${resetToken}`)
            .send({ password: 'AnotherPassword123' });
        
        expect(res2.statusCode).toBe(400); // Invalid or expired
    });
});
