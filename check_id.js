const mongoose = require('mongoose');

const strings = [
    "Construction", // 12 chars
    "Architecture", // 12 chars
    "123456789012", // 12 chars
    "ValidObjectIdThisIsNot", // 22 chars
    "507f1f77bcf86cd799439011", // Valid 24 hex
    "condo",
    "Apartment"
];

console.log('--- Checking ObjectId Validity ---');
strings.forEach(s => {
    const isValid = mongoose.Types.ObjectId.isValid(s);
    console.log(`"${s}" (${s.length} chars) -> ${isValid}`);
});
