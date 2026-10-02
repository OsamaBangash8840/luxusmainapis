const http = require('http');

function request(path, method, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 6000,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    console.log('--- Verifying Stripe & Tour Implementation ---');

    try {
        // 1. Create Payment Intent
        console.log('\n1. Creating Payment Intent ($10.00)...');
        const payment = await request('/create-payment-intent', 'POST', { amount: 1000 });
        console.log(`Status: ${payment.status}`);

        if (payment.status !== 200) {
            console.error('Failed to create payment intent:', payment.body);
            return;
        }

        const paymentIntentId = payment.body.data.paymentIntentId;
        console.log('Payment Intent ID:', paymentIntentId);

        // 2. Schedule Normal Tour (Should work without payment)
        // Need a valid property ID first
        const properties = await request('/properties', 'GET');
        if (!properties.body.data || properties.body.data.length === 0) {
            console.error('No properties found to test with');
            return;
        }
        const propId = properties.body.data[0]._id;
        console.log(`Using Property ID: ${propId}`);

        console.log('\n2. Scheduling Normal Tour...');
        const normalTour = await request('/schedule-tour', 'POST', {
            propertyId: propId,
            name: 'Test User',
            email: 'test@example.com',
            phone: '1234567890',
            date: '2025-12-25',
            time: '10:00',
            message: 'Normal tour test'
        });
        console.log(`Status: ${normalTour.status}`);
        console.log('Is Premium:', normalTour.body.data?.isPremium);

        // 3. Schedule Premium Tour WITHOUT Payment ID (Should Fail)
        console.log('\n3. Scheduling Premium Tour WITHOUT Payment ID...');
        const failTour = await request('/schedule-tour', 'POST', {
            propertyId: propId,
            name: 'Test User Premium Fail',
            email: 'test@example.com',
            phone: '1234567890',
            date: '2025-12-26',
            time: '10:00',
            message: 'Premium fail test',
            isPremium: true
        });
        console.log(`Status: ${failTour.status} (Expected 400)`);
        console.log('Error:', failTour.body.message);

        // 4. Schedule Premium Tour WITH Payment ID (Should Success)
        console.log('\n4. Scheduling Premium Tour WITH Payment ID...');
        const successTour = await request('/schedule-tour', 'POST', {
            propertyId: propId,
            name: 'Test User Premium Success',
            email: 'test@example.com',
            phone: '1234567890',
            date: '2025-12-27',
            time: '10:00',
            message: 'Premium success test',
            isPremium: true,
            paymentIntentId: paymentIntentId
        });
        console.log(`Status: ${successTour.status} (Expected 200)`);
        console.log('Is Premium:', successTour.body.data?.isPremium);
        console.log('Payment Status:', successTour.body.data?.paymentStatus);

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
