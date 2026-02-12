import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/pricing-analysis/one-view-price-grid`;

async function testOneViewGrid() {
    try {
        console.log(`Testing API: ${BASE_URL}`);

        const params = {
            startDate: '2025-11-01',
            endDate: '2025-11-30',
            platform: 'Blinkit'
        };

        const response = await axios.get(BASE_URL, { params });

        console.log('Status:', response.status);
        console.log('Success:', response.data.success);

        if (response.data.success && response.data.data.length > 0) {
            const firstItem = response.data.data[0];
            console.log('Sample Item Layout:');
            console.log(JSON.stringify(firstItem, null, 2));

            const hasRpi = 'rpi' in firstItem;
            console.log('\nHas RPI field:', hasRpi ? '✅ YES' : '❌ NO');

            if (hasRpi) {
                console.log('RPI Value:', firstItem.rpi);
            }
        } else {
            console.log('No data returned.');
            console.log('Response body:', JSON.stringify(response.data, null, 2));
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

testOneViewGrid();
