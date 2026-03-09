
import { queryClickHouse } from './src/services/watchTowerService.js';

async function test() {
    try {
        const result = await queryClickHouse(`
            SELECT weekly_category_size 
            FROM test_brand_MS 
            LIMIT 1
        `);
        console.log('Success! Result:', result);
    } catch (err) {
        console.error('Error querying weekly_category_size:', err.message);
    }
    process.exit(0);
}

test();
