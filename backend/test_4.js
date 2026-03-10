import 'dotenv/config';
import wt from './src/services/watchTowerService.js';

async function test4() {
    process.on('unhandledRejection', (reason, promise) => {
        console.error('--- UNHANDLED REJECTION ---');
        console.error('Promise:', promise);
        console.error('Reason:', reason);
    });

    console.log('Testing getCompetitionBrandTrends with brands: "Snickers, Galaxy"');
    try {
        const res = await wt.getCompetitionBrandTrends({
            brands: 'Snickers, Galaxy',
            skus: 'All',
            period: '1M'
        });
        console.log('RESULT data points count:', Object.keys(res.data).length);
    } catch (err) {
        console.error('ERROR:', err);
    }
}

test4();
