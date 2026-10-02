const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
    console.error('Usage: node createAdmin.js <email>');
    process.exit(1);
}

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({ email });
        if (!user) {
            console.error(`User with email ${email} not found.`);
            process.exit(1);
        }

        user.role = 'admin';
        await user.save();
        console.log(`User ${email} successfully promoted to admin.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

createAdmin();
