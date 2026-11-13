import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import watchTowerService from './backend/src/services/watchTowerService.js';

async function test() {
    try {
        console.log('Testing watchTowerService.getRcaData with brand filter...');
        const result = await watchTowerService.getRcaData({ platform: 'Blinkit', brand: 'Boomer' });

        const tree = result.tree;
        console.log('Root Node:', tree.label, tree.value);

        if (tree.metrics && tree.metrics.length > 0) {
            console.log('Metrics found:', tree.metrics.length);
            console.log('First metric brand/entity:', tree.metrics[0].brand);

            if (tree.metrics[0].brand.toLowerCase().includes('boomer')) {
                console.log('SUCCESS: SKU-level metrics detected (entity name contains brand name).');
            } else {
                console.log('FAILURE: Still showing brand-level metrics (e.g. Snickers/Galaxy) or unexpected data.');
            }
        } else {
            console.log('FAILURE: No metrics found in tree.');
        }

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

test();
