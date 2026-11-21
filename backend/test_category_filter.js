
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
process.env.CLICKHOUSE_DB = process.env.CLICKHOUSE_DB || 'mars';

async function testCategoryFiltering() {
    try {
        const { default: visibilityService } = await import('./src/services/visibilityService.js');
        
        console.log('--- Testing Case Sensitivity and "all" ---');
        
        // 1. All (uppercase)
        console.log('\n[1] category="All" (Control):');
        const data1 = await visibilityService.getVisibilityOverviewData({
            startDate: '2026-02-15',
            endDate: '2026-02-21',
            category: 'All'
        });
        console.log(`Value: ${data1.cards[0].value}`);

        // 2. all (lowercase)
        console.log('\n[2] category="all":');
        const data2 = await visibilityService.getVisibilityOverviewData({
            startDate: '2026-02-15',
            endDate: '2026-02-21',
            category: 'all'
        });
        console.log(`Value: ${data2.cards[0].value}`);

        // 3. Lowercase category name
        console.log('\n[3] category="chocolates (non gifting)" (lowercase name):');
        const data3 = await visibilityService.getVisibilityOverviewData({
            startDate: '2026-02-15',
            endDate: '2026-02-21',
            category: 'chocolates (non gifting)'
        });
        console.log(`Value: ${data3.cards[0].value}`);

        // 4. Correct category name
        console.log('\n[4] category="Chocolates (Non Gifting)" (Correct):');
        const data4 = await visibilityService.getVisibilityOverviewData({
            startDate: '2026-02-15',
            endDate: '2026-02-21',
            category: 'Chocolates (Non Gifting)'
        });
        console.log(`Value: ${data4.cards[0].value}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testCategoryFiltering();
