const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { initializeSocket, getIO } = require('../socketConnection');
const User = require('../models/User');
const { Property } = require('../models/Property');
const Conversation = require('../models/Conversation');
const jwt = require('jsonwebtoken');
const app = require('../app');
const mongoose = require('mongoose');

describe('Socket Endpoints', () => {
    let io, httpServer, port;
    let seller, buyer, hacker;
    let sellerToken, buyerToken, hackerToken;
    let conversation;

    let property;

    beforeAll((done) => {
        httpServer = createServer(app);
        initializeSocket(httpServer);
        httpServer.listen(0, () => {
            port = httpServer.address().port;
            done();
        });
    });

    afterAll((done) => {
        getIO().close();
        httpServer.close();
        done();
    });

    beforeEach(async () => {
        seller = await User.create({ username: 's', email: 's@t.com', password: 'Password123', role: 'seller', isVerified: true });
        buyer = await User.create({ username: 'b', email: 'b@t.com', password: 'Password123', role: 'buyer', isVerified: true });
        hacker = await User.create({ username: 'h', email: 'h@t.com', password: 'Password123', role: 'buyer', isVerified: true });

        sellerToken = jwt.sign({ id: seller._id, role: seller.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
        buyerToken = jwt.sign({ id: buyer._id, role: buyer.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
        hackerToken = jwt.sign({ id: hacker._id, role: hacker.role }, process.env.TOKEN_SECRET, { expiresIn: '1h' });

        property = await Property.create({
            title: 'Prop 1',
            description: 'Desc',
            price: 100,
            seller: seller._id,
            status: 'approved',
            category: new mongoose.Types.ObjectId(),
            location: { type: 'Point', coordinates: [0, 0] }
        });

        conversation = await Conversation.create({
            propertyId: property._id,
            buyerId: buyer._id,
            sellerId: seller._id,
        });
    });



    it('a user who is not a participant cannot send a message', (done) => {
        const clientSocket = new Client(`http://localhost:${port}`, {
            auth: { token: hackerToken }
        });

        clientSocket.on('connect', () => {
            clientSocket.emit('newMessage', { 
                conversationId: conversation._id.toString(),
                content: 'Hacked',
                messageType: 'text'
            });
        });

        clientSocket.on('error', (err) => {
            try {
                expect(err.message).toMatch(/Unauthorized/i);
                clientSocket.close();
                done();
            } catch (e) {
                clientSocket.close();
                done(e);
            }
        });
    });
});
