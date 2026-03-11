
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
process.env.CLICKHOUSE_DB = process.env.CLICKHOUSE_DB || 'mars';

async function verifyCategoryFix() {
    try {
        const { default: visibilityService } = await import('./src/services/visibilityService.js');
        
        console.log('--- Verifying Category Filtering Fixes ---');
        
        const baseFilters = {
            startDate: '2026-02-15',
            endDate: '2026-02-21',
            platform: 'All',
            brand: 'All',
            location: 'All'
        };

        // 1. Control (No category)
        console.log('\n[1] Testing with category="All":');
        const dataAll = await visibilityService.getVisibilityOverviewData({ ...baseFilters, category: 'All' });
        const valAll = dataAll.cards[0].value;
        console.log(`Overall SOS (All): ${valAll}`);

        // 2. Filter by Chocolates (Non Gifting) - Standard Case
        console.log('\n[2] Testing with category="Chocolates (Non Gifting)":');
        const dataStandard = await visibilityService.getVisibilityOverviewData({ ...baseFilters, category: 'Chocolates (Non Gifting)' });
        const valStandard = dataStandard.cards[0].value;
        console.log(`Overall SOS (Standard): ${valStandard}`);

        // 3. Filter by lowercase all
        console.log('\n[3] Testing with category="all":');
        const dataLowerAll = await visibilityService.getVisibilityOverviewData({ ...baseFilters, category: 'all' });
        const valLowerAll = dataLowerAll.cards[0].value;
        console.log(`Overall SOS (all): ${valLowerAll}`);

        // 4. Testing with 'format' instead of 'category'
        console.log('\n[4] Testing with format="Chocolates (Non Gifting)":');
        const dataFormat = await visibilityService.getVisibilityOverviewData({ ...baseFilters, format: 'Chocolates (Non Gifting)' });
        const valFormat = dataFormat.cards[0].value;
        console.log(`Overall SOS (format): ${valFormat}`);

        // 5. Testing with lowercase category name
        console.log('\n[5] Testing with category="chocolates (non gifting)":');
        const dataLowerCat = await visibilityService.getVisibilityOverviewData({ ...baseFilters, category: 'chocolates (non gifting)' });
        const valLowerCat = dataLowerCat.cards[0].value;
        console.log(`Overall SOS (lowercase category): ${valLowerCat}`);

        console.log('\n--- VERDICT ---');
        if (valAll !== valStandard) {
            console.log('✅ PASS: Filter changed the results.');
        } else {
            console.log('❌ FAIL: Filter did not change results (or data is identical).');
        }

        if (valAll === valLowerAll) {
            console.log('✅ PASS: Lowercase "all" treated as "All".');
        } else {
            console.log('❌ FAIL: Lowercase "all" incorrectly filtered data.');
        }

        if (valStandard === valFormat) {
            console.log('✅ PASS: "category" and "format" work identically.');
        } else {
            console.log('❌ FAIL: "category" and "format" produced different results.');
        }

        if (valStandard === valLowerCat) {
            console.log('✅ PASS: Category filtering is case-insensitive.');
        } else {
            console.log('❌ FAIL: Category filtering is case-sensitive.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Verification failed:');
        console.error(err);
        process.exit(1);
    }
}

verifyCategoryFix();
