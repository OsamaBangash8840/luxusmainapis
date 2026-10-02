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
    console.log('--- Checking Data Integrity ---');
    try {
        // 1. Get all properties
        console.log('Fetching all properties...');
        const allProps = await get('/properties');
        if (!allProps.body || !allProps.body.data || allProps.body.data.length === 0) {
            console.log('No properties found.');
            return;
        }

        const firstProp = allProps.body.data[0];
        const catId = firstProp.category;
        console.log(`First Property ID: ${firstProp._id}`);
        console.log(`Property Category ID: ${catId}`);

        // 2. Get that category detail (using getAllCategories and finding it)
        console.log('Fetching all categories...');
        const allCats = await get('/categories');
        const cat = allCats.body.data.find(c => c._id === catId);

        if (cat) {
            console.log(`Found Category in DB: "${cat.name}" (ID: ${cat._id})`);

            // 3. Try to fetch properties by this name
            console.log(`Fetching properties by name: "${cat.name}"`);
            const byName = await get(`/category/${cat.name}`);
            console.log(`Status: ${byName.status}, Count: ${byName.body?.data?.length}`);

            // 4. Try with trimmed name search if it has spaces
            const trimmed = cat.name.trim();
            if (trimmed !== cat.name) {
                console.log(`Wait, category name has spaces! Trying trimmed: "${trimmed}"`);
                const byTrimmed = await get(`/category/${trimmed}`);
                console.log(`Status: ${byTrimmed.status}, Count: ${byTrimmed.body?.data?.length}`);
            }
        } else {
            console.log('CRITICAL: Property has category ID that does not exist in Categories collection!');
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
