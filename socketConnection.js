const { Server } = require('socket.io');
const mongoose = require('mongoose');
const User = require('./models/User');
const { Property } = require('./models/Property');
const Conversation = require('./models/Conversation');
const Message = require('./models/Messages');
const verifySocketToken = require('./middlewares/socketsToken');

// In-memory mapping of userId to socketId
const userSocketMap = {};
let io;

function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            methods: ['GET', 'POST']
        },
        pingTimeout: 60000, // Increase ping timeout for better reliability
    });

    io.use(verifySocketToken);

    io.on('connection', (socket) => {
        if (socket.user && socket.user.id) {
            const userId = socket.user.id;
            userSocketMap[userId] = socket.id;

            // Update user's online status and last activity
            updateUserActivity(userId);

            // Broadcast online status to relevant users
            broadcastUserStatus(userId, true);
        }

        // Socket event handlers
        socket.on('joinConversation', handleJoinConversation(socket));
        socket.on('typing', handleTyping(socket));
        socket.on('stopTyping', handleStopTyping(socket));
        socket.on('newMessage', handleNewMessage(socket));
        socket.on('markAsRead', handleMarkAsRead(socket));
        socket.on('editMessage', handleEditMessage(socket));
        socket.on('deleteMessage', handleDeleteMessage(socket));
        socket.on('sendOffer', handleSendOffer(socket));
        socket.on('respondToOffer', handleRespondToOffer(socket));
        socket.on('counterOffer', handleCounterOffer(socket));
        socket.on('pinConversation', handlePinConversation(socket));
        socket.on('archiveConversation', handleArchiveConversation(socket));
        socket.on('sendReaction', handleSendReaction(socket));
        socket.on('getUserStatus', handleGetUserStatus(socket));
        socket.on('markNotificationRead', handleMarkNotificationRead(socket));

        // Handle Disconnect
        socket.on('disconnect', () => {
            if (socket.user && socket.user.id) {
                const userId = socket.user.id;
                delete userSocketMap[userId];

                // Broadcast offline status after a short delay
                // (in case of quick reconnect like page refresh)
                setTimeout(() => {
                    if (!userSocketMap[userId]) {
                        broadcastUserStatus(userId, false);
                    }
                }, 5000);
            }
            console.log('User disconnected:', socket.id);
        });
    });
}

// Helper functions for handling socket events
function handleJoinConversation(socket) {
    return async ({ propertyId, buyerId, sellerId }) => {
        try {
            // Validate if property exists
            const property = await Property.findById(propertyId);
            if (!property) {
                socket.emit('error', { message: 'Property not found' });
                return;
            }

            // Validate participants
            if (!mongoose.Types.ObjectId.isValid(buyerId) || !mongoose.Types.ObjectId.isValid(sellerId) || !mongoose.Types.ObjectId.isValid(propertyId)) {
                socket.emit('error', { message: 'Invalid IDs' });
                return;
            }

            const buyer = await User.findById(buyerId);
            const seller = await User.findById(sellerId);

            if (!buyer || !seller) {
                socket.emit('error', { message: 'Invalid participants' });
                return;
            }

            // Verify seller actually owns the property
            if (property.seller.toString() !== sellerId) {
                socket.emit('error', { message: 'Unauthorized: Seller does not own this property' });
                return;
            }

            // Force buyerId to caller's ID if caller is the buyer
            const socketUserId = socket.user.id;
            let actualBuyerId = buyerId;
            
            if (socketUserId !== sellerId) {
                actualBuyerId = socketUserId;
            }

            if (socketUserId !== actualBuyerId && socketUserId !== sellerId) {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            // Find or create conversation
            let conversation = await Conversation.findOne({ propertyId, buyerId: actualBuyerId, sellerId });

            if (!conversation) {
                conversation = new Conversation({
                    propertyId,
                    buyerId: actualBuyerId,
                    sellerId
                });
                await conversation.save();
            }

            const conversationId = conversation._id.toString();
            socket.join(conversationId);

            // Fetch messages with pagination
            const messages = await Message.find({ conversationId })
                .sort({ createdAt: -1 })
                .limit(20)
                .populate('senderId', 'username avatar')
                .lean();

            // Send conversation history to the user
            socket.emit('conversationHistory', {
                conversation,
                messages: messages.reverse(),
                property: {
                    _id: property._id,
                    title: property.title,
                    price: property.price,
                    images: property.images[0] || null // Send first image as preview
                }
            });

            console.log(`User ${socket.user.id} joined conversation: ${conversationId}`);
        } catch (error) {
            console.error('Error joining conversation:', error);
            socket.emit('error', { message: 'Failed to join conversation' });
        }
    };
}

function handleNewMessage(socket) {
    return async ({ conversationId, content, messageType, fileUrl, isOffer, offerDetails }) => {
        try {
            const senderId = socket.user.id;
            
            if (!content || typeof content !== 'string' || content.length < 1 || content.length > 2000) {
                socket.emit('error', { message: 'Invalid content' });
                return;
            }
            if (!['text', 'image', 'file'].includes(messageType)) {
                socket.emit('error', { message: 'Invalid message type' });
                return;
            }

            const conversation = await Conversation.findById(conversationId);
            if (!conversation) {
                socket.emit('error', { message: 'Conversation not found' });
                return;
            }

            // Verify the sender is part of this conversation
            if (senderId !== conversation.buyerId.toString() && senderId !== conversation.sellerId.toString()) {
                socket.emit('error', { message: 'Unauthorized to send message in this conversation' });
                return;
            }

            const receiverId = senderId === conversation.buyerId.toString()
                ? conversation.sellerId.toString()
                : conversation.buyerId.toString();

            // Create new message - using our Message model schema
            const newMessage = new Message({
                conversationId,
                senderId,
                receiverId,
                messageType,
                content,
                fileUrl,
                status: 'sent',
                seenBy: [senderId] // Sender has seen their own message
            });

            // Add offer details if it's an offer message
            if (isOffer && offerDetails) {
                // Since our original schema doesn't have offerDetails field, we'll add it
                newMessage.isOffer = true;
                newMessage.offerDetails = offerDetails;
            }

            await newMessage.save();

            // Update conversation
            // Update conversation
            conversation.lastMessageAt = new Date();
            await conversation.save();

            // Populate sender info for the frontend
            const populatedMessage = await Message.findById(newMessage._id)
                .populate('senderId', 'username avatar')
                .lean();

            // Send to room (conversation)
            io.to(conversationId).emit('newMessage', populatedMessage);

            // Send direct notification if receiver is not in the room
            const receiverSocketId = userSocketMap[receiverId];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('newMessageNotification', {
                    message: populatedMessage,
                    conversation: {
                        _id: conversation._id,
                        propertyId: conversation.propertyId
                    }
                });
            }

            // Create notification for the receiver
            await createNotification(receiverId, {
                type: isOffer ? 'offer' : 'message',
                content: isOffer ? `New offer of ${offerDetails.amount}` :
                    `New message: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`,
                relatedId: newMessage._id
            });

        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    };
}

function handleSendOffer(socket) {
    return async ({ conversationId, amount, notes }) => {
        try {
            const senderId = socket.user.id;
            const conversation = await Conversation.findById(conversationId);

            if (!conversation) {
                socket.emit('error', { message: 'Conversation not found' });
                return;
            }

            if (!amount || amount <= 0) {
                socket.emit('error', { message: 'Offer amount must be greater than 0' });
                return;
            }

            // Verify the sender is the buyer in this conversation
            if (senderId !== conversation.buyerId.toString()) {
                socket.emit('error', { message: 'Only buyers can send offers' });
                return;
            }

            const existingOffer = await Message.findOne({
                conversationId,
                isOffer: true,
                'offerDetails.status': 'pending'
            });

            if (existingOffer) {
                if (existingOffer.offerDetails.expiresAt < Date.now()) {
                    existingOffer.offerDetails.status = 'expired';
                    await existingOffer.save();
                } else {
                    socket.emit('error', { message: 'There is already a pending offer in this conversation' });
                    return;
                }
            }

            // Additional role validation - ensure user actually has buyer role
            const sender = await User.findById(senderId);
            if (!sender || sender.role !== 'buyer') {
                socket.emit('error', { message: 'User must have buyer role to send offers' });
                return;
            }

            // Verify if the property is still for sale
            const property = await Property.findById(conversation.propertyId);
            if (!property || property.propertyStatus !== 'for sale') {
                socket.emit('error', { message: 'This property is no longer available for sale' });
                return;
            }

            // Create offer message
            await handleNewMessage(socket)({
                conversationId,
                content: `Offer: ${amount}`,
                senderId,
                messageType: 'text',
                isOffer: true,
                offerDetails: {
                    amount,
                    status: 'pending',
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiration
                    notes
                }
            });

        } catch (error) {
            console.error('Error sending offer:', error);
            socket.emit('error', { message: 'Failed to send offer' });
        }
    };
}

function handleRespondToOffer(socket) {
    return async ({ messageId, status, notes }) => {
        try {
            const userId = socket.user.id;
            const message = await Message.findById(messageId);

            if (!message || !message.isOffer) {
                socket.emit('error', { message: 'Invalid offer' });
                return;
            }

            const conversation = await Conversation.findById(message.conversationId);

            if (message.offerDetails.expiresAt < Date.now()) {
                message.offerDetails.status = 'expired';
                await message.save();
                socket.emit('error', { message: 'This offer has expired' });
                return;
            }

            // Only the party who did NOT create the pending offer can respond
            if (userId === message.senderId.toString()) {
                socket.emit('error', { message: 'Cannot respond to your own offer' });
                return;
            }

            // Update offer status
            if (!message.offerDetails) {
                message.offerDetails = {};
            }
            message.offerDetails.status = status;
            if (notes) message.offerDetails.notes = notes;
            await message.save();

            // If offer is accepted, update property status
            if (status === 'accepted') {
                await Property.findByIdAndUpdate(conversation.propertyId, {
                    propertyStatus: 'under offer'
                });

                // Reject other open offers for this property
                const otherConvos = await Conversation.find({ propertyId: conversation.propertyId, _id: { $ne: conversation._id } });
                for (const c of otherConvos) {
                    const pendingOffer = await Message.findOne({ conversationId: c._id, isOffer: true, 'offerDetails.status': 'pending' });
                    if (pendingOffer) {
                        pendingOffer.offerDetails.status = 'rejected';
                        pendingOffer.offerDetails.notes = 'Property is under offer with another buyer';
                        await pendingOffer.save();
                        await createNotification(c.buyerId, { type: 'offer', content: 'Your offer was rejected because the property is under offer.', relatedId: pendingOffer._id });
                    }
                }
            }

            // Notify the room about the offer update
            io.to(conversation._id.toString()).emit('offerStatusUpdated', {
                messageId,
                status,
                notes
            });

            // Create notification for buyer
            await createNotification(conversation.buyerId, {
                type: 'offer',
                content: `Your offer was ${status}`,
                relatedId: messageId
            });

            // Create a system message about the response
            const systemMessage = new Message({
                conversationId: conversation._id,
                senderId: userId,
                receiverId: conversation.buyerId,
                messageType: 'text',
                content: `Offer for ${message.offerDetails.amount} was ${status}${notes ? `: "${notes}"` : ''}`,
                status: 'sent',
                seenBy: [userId]
            });

            await systemMessage.save();
            // Update conversation
            conversation.lastMessageAt = new Date();
            await conversation.save();

            // Send system message to room
            const populatedSystemMessage = await Message.findById(systemMessage._id)
                .populate('senderId', 'username avatar')
                .lean();

            io.to(conversation._id.toString()).emit('newMessage', populatedSystemMessage);

        } catch (error) {
            console.error('Error responding to offer:', error);
            socket.emit('error', { message: 'Failed to respond to offer' });
        }
    };
}

function handleCounterOffer(socket) {
    return async ({ messageId, counterAmount, notes }) => {
        try {
            const userId = socket.user.id;
            const message = await Message.findById(messageId);

            if (!message || !message.isOffer) {
                socket.emit('error', { message: 'Invalid offer' });
                return;
            }

            const conversation = await Conversation.findById(message.conversationId);

            if (!counterAmount || counterAmount <= 0) {
                socket.emit('error', { message: 'Counter amount must be greater than 0' });
                return;
            }

            if (message.offerDetails.expiresAt < Date.now()) {
                message.offerDetails.status = 'expired';
                await message.save();
                socket.emit('error', { message: 'This offer has expired' });
                return;
            }

            // Only the party who did NOT create the pending offer can counter
            if (userId === message.senderId.toString()) {
                socket.emit('error', { message: 'Cannot counter your own offer' });
                return;
            }

            // Update offer with counter details
            if (!message.offerDetails) {
                message.offerDetails = {};
            }
            message.offerDetails.status = 'countered';
            message.offerDetails.counterAmount = counterAmount;
            if (notes) message.offerDetails.notes = notes;
            await message.save();

            // Notify the room about the counter offer
            io.to(conversation._id.toString()).emit('offerCountered', {
                messageId,
                counterAmount,
                notes
            });

            // Create notification for buyer
            await createNotification(conversation.buyerId, {
                type: 'offer',
                content: `Your offer received a counter offer of ${counterAmount}`,
                relatedId: messageId
            });

            // Create a counter offer message
            const counterMessage = new Message({
                conversationId: conversation._id,
                senderId: userId,
                receiverId: conversation.buyerId,
                messageType: 'text',
                content: `Counter offer: ${counterAmount}`,
                status: 'sent',
                isOffer: true,
                offerDetails: {
                    amount: counterAmount,
                    status: 'pending',
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    notes
                },
                seenBy: [userId]
            });

            await counterMessage.save();
            // Update conversation
            conversation.lastMessageAt = new Date();
            await conversation.save();

            // Send counter offer to room
            const populatedCounterMessage = await Message.findById(counterMessage._id)
                .populate('senderId', 'username avatar')
                .lean();

            io.to(conversation._id.toString()).emit('newMessage', populatedCounterMessage);

        } catch (error) {
            console.error('Error sending counter offer:', error);
            socket.emit('error', { message: 'Failed to send counter offer' });
        }
    };
}

function handleTyping(socket) {
    return async ({ conversationId }) => {
        const userId = socket.user.id;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || (userId !== conversation.buyerId.toString() && userId !== conversation.sellerId.toString())) {
            return;
        }
        socket.to(conversationId).emit('userTyping', { userId });
    };
}

function handleStopTyping(socket) {
    return async ({ conversationId }) => {
        const userId = socket.user.id;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || (userId !== conversation.buyerId.toString() && userId !== conversation.sellerId.toString())) {
            return;
        }
        socket.to(conversationId).emit('userStoppedTyping', { userId });
    };
}

function handleMarkAsRead(socket) {
    return async ({ messageId }) => {
        try {
            const userId = socket.user.id;
            const message = await Message.findById(messageId);

            if (!message) {
                return;
            }
            
            const conversation = await Conversation.findById(message.conversationId);
            if (!conversation || (userId !== conversation.buyerId.toString() && userId !== conversation.sellerId.toString())) {
                return;
            }

            // Add user to seenBy array if not already there
            if (!message.seenBy.includes(userId)) {
                message.seenBy.push(userId);
                message.status = 'read';
                await message.save();

                // Notify other users that this message was read
                socket.to(message.conversationId.toString()).emit('messageRead', {
                    messageId,
                    userId
                });
            }
        } catch (error) {
            console.error('Error marking message as read:', error);
        }
    };
}

function handleEditMessage(socket) {
    return async ({ messageId, newContent }) => {
        try {
            const userId = socket.user.id;
            const message = await Message.findById(messageId);

            if (!message) {
                socket.emit('error', { message: 'Message not found' });
                return;
            }

            // Only sender can edit their message
            if (message.senderId.toString() !== userId) {
                socket.emit('error', { message: 'Unauthorized to edit this message' });
                return;
            }

            // Don't allow editing offers that have been responded to
            if (message.isOffer && message.offerDetails && message.offerDetails.status !== 'pending') {
                socket.emit('error', { message: 'Cannot edit messages that have been responded to' });
                return;
            }

            // Update message content
            message.content = newContent;
            message.edited = true;
            await message.save();

            // Notify conversation about edited message
            io.to(message.conversationId.toString()).emit('messageEdited', {
                messageId,
                content: newContent
            });
        } catch (error) {
            console.error('Error editing message:', error);
            socket.emit('error', { message: 'Failed to edit message' });
        }
    };
}

function handleDeleteMessage(socket) {
    return async ({ messageId }) => {
        try {
            const userId = socket.user.id;
            const message = await Message.findById(messageId);

            if (!message) {
                socket.emit('error', { message: 'Message not found' });
                return;
            }

            // Only sender can delete their message
            if (message.senderId.toString() !== userId) {
                socket.emit('error', { message: 'Unauthorized to delete this message' });
                return;
            }

            // Don't allow deleting offers that have been responded to
            if (message.isOffer && message.offerDetails && message.offerDetails.status !== 'pending') {
                socket.emit('error', { message: 'Cannot delete messages that have been responded to' });
                return;
            }

            // Soft delete - mark as deleted but keep in database
            message.isDeleted = true;
            message.content = 'This message was deleted';
            await message.save();

            // Notify conversation about deleted message
            io.to(message.conversationId.toString()).emit('messageDeleted', {
                messageId,
                content: 'This message was deleted'
            });

        } catch (error) {
            console.error('Error deleting message:', error);
            socket.emit('error', { message: 'Failed to delete message' });
        }
    };
}

function handlePinConversation(socket) {
    return async ({ conversationId, pin }) => {
        try {
            const userId = socket.user.id;
            const conversation = await Conversation.findById(conversationId);

            if (!conversation) {
                socket.emit('error', { message: 'Conversation not found' });
                return;
            }

            // Check if user is part of this conversation
            if (userId !== conversation.buyerId.toString() && userId !== conversation.sellerId.toString()) {
                socket.emit('error', { message: 'Unauthorized to pin this conversation' });
                return;
            }

            // Initialize pinnedBy array if it doesn't exist
            if (!conversation.pinnedBy) {
                conversation.pinnedBy = [];
            }

            if (pin) {
                // Add to pinned if not already there
                if (!conversation.pinnedBy.includes(userId)) {
                    conversation.pinnedBy.push(userId);
                }
            } else {
                // Remove from pinned
                conversation.pinnedBy = conversation.pinnedBy.filter(
                    id => id.toString() !== userId
                );
            }

            await conversation.save();

            // Confirm action to user
            socket.emit('conversationPinned', {
                conversationId,
                pinned: pin
            });

        } catch (error) {
            console.error('Error pinning conversation:', error);
            socket.emit('error', { message: 'Failed to pin conversation' });
        }
    };
}

function handleArchiveConversation(socket) {
    return async ({ conversationId, archive }) => {
        try {
            const userId = socket.user.id;
            const conversation = await Conversation.findById(conversationId);

            if (!conversation) {
                socket.emit('error', { message: 'Conversation not found' });
                return;
            }

            // Check if user is part of this conversation
            if (userId !== conversation.buyerId.toString() && userId !== conversation.sellerId.toString()) {
                socket.emit('error', { message: 'Unauthorized to archive this conversation' });
                return;
            }

            // Initialize status field if it doesn't exist
            if (!conversation.status) {
                conversation.status = 'active';
            }

            // Set status based on whether we're archiving or unarchiving
            conversation.status = archive ? 'archived' : 'active';
            await conversation.save();

            // Confirm action to user
            socket.emit('conversationArchived', {
                conversationId,
                archived: archive
            });

        } catch (error) {
            console.error('Error archiving conversation:', error);
            socket.emit('error', { message: 'Failed to archive conversation' });
        }
    };
}

function handleSendReaction(socket) {
    return async ({ messageId, reaction }) => {
        try {
            const userId = socket.user.id;
            const message = await Message.findById(messageId);

            if (!message) {
                socket.emit('error', { message: 'Message not found' });
                return;
            }

            // Initialize reactions array if it doesn't exist
            if (!message.reactions) {
                message.reactions = [];
            }

            // Check if user already reacted
            const existingReactionIndex = message.reactions.findIndex(
                r => r.userId && r.userId.toString() === userId
            );

            if (existingReactionIndex !== -1) {
                // Update existing reaction
                message.reactions[existingReactionIndex].reaction = reaction;
            } else {
                // Add new reaction
                message.reactions.push({
                    userId,
                    reaction
                });
            }

            await message.save();

            // Broadcast reaction to the conversation
            io.to(message.conversationId.toString()).emit('messageReaction', {
                messageId,
                userId,
                reaction
            });

        } catch (error) {
            console.error('Error sending reaction:', error);
            socket.emit('error', { message: 'Failed to send reaction' });
        }
    };
}

// Helper utility functions
async function updateUserActivity(userId) {
    try {
        await User.findByIdAndUpdate(userId, {
            lastActive: new Date()
        });
    } catch (error) {
        console.error('Error updating user activity:', error);
    }
}

async function broadcastUserStatus(userId, isOnline) {
    try {
        // Find conversations this user is part of
        const conversations = await Conversation.find({
            $or: [{ buyerId: userId }, { sellerId: userId }],
            status: 'active' // Don't broadcast to archived conversations
        });

        // Get all users who need to know about this user's status
        const recipientIds = new Set();

        conversations.forEach(convo => {
            if (convo.buyerId.toString() === userId) {
                recipientIds.add(convo.sellerId.toString());
            } else {
                recipientIds.add(convo.buyerId.toString());
            }
        });

        // Broadcast status to all relevant users
        recipientIds.forEach(recipientId => {
            const recipientSocketId = userSocketMap[recipientId];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('userStatusChanged', {
                    userId,
                    isOnline
                });
            }
        });
    } catch (error) {
        console.error('Error broadcasting user status:', error);
    }
}

const Notification = require('./models/Notification');

async function createNotification(userId, { type, content, relatedId }) {
    try {
        const notification = new Notification({
            userId,
            type,
            content,
            relatedId
        });

        await notification.save();

        // Send notification to user if online
        const userSocketId = userSocketMap[userId];
        if (userSocketId) {
            io.to(userSocketId).emit('newNotification', notification);
        }
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

// Functions to handle user status and notification management
function handleGetUserStatus(socket) {
    return async ({ userIds }) => {
        try {
            if (!Array.isArray(userIds) || userIds.length > 50) {
                socket.emit('error', { message: 'Invalid userIds' });
                return;
            }
            const validIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
            
            const callerId = socket.user.id;
            const conversations = await Conversation.find({
                $or: [{ buyerId: callerId }, { sellerId: callerId }]
            });
            const allowedIds = new Set();
            conversations.forEach(c => {
                allowedIds.add(c.buyerId.toString());
                allowedIds.add(c.sellerId.toString());
            });
            
            const idsToCheck = validIds.filter(id => allowedIds.has(id));
            
            const users = await User.find({ _id: { $in: idsToCheck } }, '_id lastActive');

            // Get online status based on socket connections
            const statuses = {};

            for (const user of users) {
                const userId = user._id.toString();
                const isOnline = !!userSocketMap[userId];
                statuses[userId] = { isOnline };

                // If offline, get last active time
                if (!isOnline) {
                    if (user && user.lastActive) {
                        statuses[userId].lastActive = user.lastActive;
                    }
                }
            }

            socket.emit('userStatuses', statuses);

        } catch (error) {
            console.error('Error getting user statuses:', error);
            socket.emit('error', { message: 'Failed to get user statuses' });
        }
    };
}

function handleMarkNotificationRead(socket) {
    return async ({ notificationId }) => {
        try {
            const userId = socket.user.id;

            const notification = await Notification.findOne({ _id: notificationId, userId });
            
            if (notification) {
                notification.isRead = true;
                await notification.save();

                socket.emit('notificationMarkedRead', { notificationId });
            }

        } catch (error) {
            console.error('Error marking notification as read:', error);
            socket.emit('error', { message: 'Failed to mark notification as read' });
        }
    };
}

// Utility function to send a message from the server
async function sendMessageEvent(conversationId, message) {
    try {
        const newMessage = new Message(message);
        await newMessage.save();

        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
            conversation.lastMessageAt = new Date();
            await conversation.save();

            io.to(conversationId).emit('newMessage', newMessage);
        }

        return newMessage;
    } catch (error) {
        console.error('Error in sendMessageEvent:', error);
        return null;
    }
}

// Utility function to create a conversation from the server
async function createConversationEvent(propertyId, buyerId, sellerId) {
    try {
        const conversation = new Conversation({
            propertyId,
            buyerId,
            sellerId
        });

        await conversation.save();
        return conversation;
    } catch (error) {
        console.error('Error in createConversationEvent:', error);
        return null;
    }
}

function getIO() {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
}

module.exports = {
    initializeSocket,
    getIO,
    userSocketMap,
    sendMessageEvent,
    createConversationEvent,
};