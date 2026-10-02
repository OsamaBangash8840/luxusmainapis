const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/luxus');
        console.log('Connected to DB');

        const { Property } = require('../models/Property');

        const properties = await Property.find({ seller: { $exists: false } });
        console.log(`Found ${properties.length} properties to migrate`);

        let count = 0;
        for (const prop of properties) {
            if (prop.owner) {
                // If it has owner but no seller, copy it
                await Property.updateOne({ _id: prop._id }, { $set: { seller: prop.owner } });
                count++;
            }
        }
        
        console.log(`Migrated ${count} properties`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
