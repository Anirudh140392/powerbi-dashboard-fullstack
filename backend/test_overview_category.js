
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
process.env.CLICKHOUSE_DB = process.env.CLICKHOUSE_DB || 'mars';

async function testOverviewCategory() {
    try {
        const { default: visibilityService } = await import('./src/services/visibilityService.js');
        
        const dateFrom = '2026-02-15';
        const dateTo = '2026-02-21';
        const category = 'Chocolates (Non Gifting)';

        console.log(`--- Testing calculateAllSOS ---`);
        
        console.log(`Testing with Category: All`);
        const resAll = await visibilityService.getVisibilityOverviewData({
            startDate: dateFrom,
            endDate: dateTo,
            category: 'All'
        });
        console.log('All Category SOS:', resAll.cards[0].value);

        console.log(`\nTesting with Category: ${category}`);
        const resCat = await visibilityService.getVisibilityOverviewData({
            startDate: dateFrom,
            endDate: dateTo,
            category: category
        });
        console.log(`${category} SOS:`, resCat.cards[0].value);

        if (resAll.cards[0].value !== resCat.cards[0].value) {
            console.log('\n✅ SUCCESS: Filtering by category changed the value.');
        } else {
            console.log('\n❌ FAILURE: Value remains the same. Filtering might be broken.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testOverviewCategory();
