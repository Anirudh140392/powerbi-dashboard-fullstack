import 'dotenv/config';
import wt from './src/services/watchTowerService.js';

async function test2() {
    console.log('Testing getCompetitionFilterOptions with category: "Chocolates (Gifting), Chocolates (Non Gifting)"');
    try {
        const res2 = await wt.getCompetitionFilterOptions({
            category: 'Chocolates (Gifting), Chocolates (Non Gifting)',
            context: 'competition'
        });
        console.log('RESULT brands count:', res2.brands.length);
        console.log('Sample brands:', res2.brands.slice(0, 5));
    } catch (err) {
        console.error('ERROR:', err);
    }
}

test2();
