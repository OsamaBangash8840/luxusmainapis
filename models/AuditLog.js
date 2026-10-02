const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, // e.g., 'ban_user', 'unban_user', 'delete_property'
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetModel: { type: String, required: true }, // e.g., 'User', 'Property'
    details: { type: Object }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
