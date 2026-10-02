const mongoose = require('mongoose');

// Mock schema and model to test sanitizeFilter behavior
mongoose.set('sanitizeFilter', true);

const tourSchema = new mongoose.Schema({
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    status: String
});
const Tour = mongoose.model('Tour', tourSchema);

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/test-luxus-sanitize');
    
    const propertyIds = [new mongoose.Types.ObjectId()];

    try {
        console.log("Test 1: no trusted");
        await Tour.countDocuments({ propertyId: { $in: propertyIds }, status: 'scheduled' });
        console.log("Test 1 passed");
    } catch (e) {
        console.error("Test 1 failed:", e.message);
    }

    try {
        console.log("Test 2: inner trusted");
        await Tour.countDocuments({ propertyId: mongoose.trusted({ $in: propertyIds }), status: 'scheduled' });
        console.log("Test 2 passed");
    } catch (e) {
        console.error("Test 2 failed:", e.message);
    }

    try {
        console.log("Test 3: outer trusted");
        await Tour.countDocuments(mongoose.trusted({ propertyId: { $in: propertyIds }, status: 'scheduled' }));
        console.log("Test 3 passed");
    } catch (e) {
        console.error("Test 3 failed:", e.message);
    }

    await mongoose.disconnect();
}

run();
