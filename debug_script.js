const http = require('http');

function get(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:6000/api${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log('--- Verifying Fix ---');
    try {
        // 1. Valid Category Name (Should be 200)
        console.log('\n1. Testing Valid Category Name (condo)...');
        const validName = await get('/category/condo');
        console.log(`Status: ${validName.status} (Expected 200)`);

        // 2. Valid Category ID (Should be 200)
        // We know 668698131ad0970c5b0f15d2 works from previous runs
        console.log('\n2. Testing Valid Category ID (668698131ad0970c5b0f15d2)...');
        const validId = await get('/category/668698131ad0970c5b0f15d2');
        console.log(`Status: ${validId.status} (Expected 200)`);

        // 3. Non-existent Category ID (Should be 404)
        // 507f1f77bcf86cd799439011 is a valid objectId but likely doesn't exist
        console.log('\n3. Testing Non-Existent Category ID (507f1f77bcf86cd799439011)...');
        const nonExistentId = await get('/category/507f1f77bcf86cd799439011');
        console.log(`Status: ${nonExistentId.status} (Expected 404)`);
        console.log(`Body:`, nonExistentId.body);

        // 4. Invalid Category Name (Should be 404)
        console.log('\n4. Testing Invalid Category Name (invalid_name)...');
        const invalidName = await get('/category/invalid_name');
        console.log(`Status: ${invalidName.status} (Expected 404)`);

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
