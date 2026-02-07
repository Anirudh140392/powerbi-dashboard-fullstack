import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import watchTowerService from './backend/src/services/watchTowerService.js';

async function test() {
    try {
        console.log('Testing watchTowerService.getTopActions...');
        const result = await watchTowerService.getTopActions({ platform: 'Zepto', endDate: '2025-12-31' });
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

test();
