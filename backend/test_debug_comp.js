import 'dotenv/config';
import wt from './src/services/watchTowerService.js';

async function debugComp() {
    console.log('--- STARTING COMPETITION DEBUG ---');
    try {
        console.log('Test: getCompetitionFilterOptions (brands) with category: "Chocolates (Gifting), Chocolates (Non Gifting)"');
        const compResult = await wt.getCompetitionFilterOptions({
            category: 'Chocolates (Gifting), Chocolates (Non Gifting)',
            context: 'competition'
        });
        console.log('SUCCESS, Sample Brands:', compResult.brands.slice(0, 3));
    } catch (err) {
        console.error('--- ERROR CAUGHT ---');
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
    }
}

debugComp();
