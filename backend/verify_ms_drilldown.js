import axios from 'axios';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'trailytics_jwt_secret_2026';

async function checkDrilldownApi() {
    try {
        console.log('Generating test token...');
        const token = jwt.sign({
            userId: 1,
            email: 'test@example.com',
            userName: 'Test User',
            dbName: 'mars'
        }, JWT_SECRET, { expiresIn: '1h' });

        console.log('Testing /api/market-share/drilldown endpoint...');
        const response = await axios.get('http://localhost:5000/api/market-share/drilldown', {
            params: {
                platform: 'All',
                category: 'Chocolates (Non Gifting)',
                location: 'All India',
                startDate: '2026-01-01',
                endDate: '2026-03-08'
            },
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        console.log('Status Code:', response.status);
        
        const data = response.data.drilldownData;
        console.log('Response Items Count:', data ? data.length : 0);
        
        if (data && data.length > 0) {
            console.log('First Brand Level Item:', JSON.stringify(data[0], null, 2).substring(0, 500) + '...');
            
            // Check children of the first brand
            const brands = data[0].children; // In my implementation, it's an array of brands
            if (brands && brands.length > 0) {
                console.log('  First Sub-Brand Level Item:', JSON.stringify(brands[0], null, 2).substring(0, 500) + '...');
                
                // Check items (SKUs) of first sub-brand
                const skus = brands[0].children;
                if (skus && skus.length > 0) {
                    console.log('    First SKU Level Item:', JSON.stringify(skus[0], null, 2).substring(0, 500) + '...');
                }
            }
        } else {
            console.log('No data returned.');
        }
        
    } catch (e) {
        console.error('API Test Failed:', e.message);
        if (e.response) {
            console.error('Error Details:', e.response.data);
        }
    }
}

checkDrilldownApi();
