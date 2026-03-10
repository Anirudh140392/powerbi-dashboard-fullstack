import { createClient } from '@clickhouse/client';

(async () => {
    const client = createClient({
        url: 'http://13.200.55.131:8123',
        username: 'readonly_user',
        password: 'Readonly@123',
        database: 'mars'
    });

    try {
        console.log('--- VERIFYING CATEGORY RESTRICTION (rb_pdp_olap) ---');

        const allowedCategories = ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];

        // 1. Check unique categories in rb_pdp_olap matches our restriction
        const categoriesRes = await client.query({
            query: `SELECT DISTINCT Category FROM rb_pdp_olap WHERE Category IN (${allowedCategories.map(c => `'${c}'`).join(',')})`,
            format: 'JSONEachRow'
        });
        const categories = await categoriesRes.json();
        console.log('Categories found (within allowed list):', categories.map(c => c.Category));

        // 2. Check if any OTHER categories exist in the table (just to be sure our query filter is what we want)
        const otherCategoriesRes = await client.query({
            query: `SELECT DISTINCT Category FROM rb_pdp_olap WHERE Category NOT IN (${allowedCategories.map(c => `'${c}'`).join(',')}) AND Category IS NOT NULL AND Category != ''`,
            format: 'JSONEachRow'
        });
        const otherCategories = await otherCategoriesRes.json();
        console.log('Other Categories in DB (should be filtered out by service):', otherCategories.map(c => c.Category));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
})();
