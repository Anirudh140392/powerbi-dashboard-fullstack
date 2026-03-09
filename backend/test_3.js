import 'dotenv/config';
import wt from './src/services/watchTowerService.js';

async function test3() {
    process.on('unhandledRejection', (reason, promise) => {
        console.error('--- UNHANDLED REJECTION ---');
        console.error('Promise:', promise);
        console.error('Reason:', reason);
    });

    console.log('Testing getProducts with brand: ["Orbit", "Snickers"]');
    try {
        const res = await wt.getProducts({
            brand: ['Orbit', 'Snickers'],
            category: ['Chocolates (Non Gifting)', 'GMFC']
        });
        console.log('RESULT products count:', res.length);
    } catch (err) {
        console.error('ERROR (expected):', err);
    }
}

test3();
