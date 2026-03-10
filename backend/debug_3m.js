import { queryClickHouse } from './src/config/clickhouse.js';

async function debugFilter() {
    try {
        console.log('--- Checking 3M products categories ---');
        const results = await queryClickHouse(`
            SELECT DISTINCT keyword_category, brand_crawl, keyword_search_product 
            FROM rb_kw 
            WHERE keyword_search_product LIKE '%3M%' 
            LIMIT 10
        `);
        console.log(JSON.stringify(results, null, 2));

        console.log('\n--- Checking Mars Category Brands ---');
        const brands = await queryClickHouse(`
            SELECT DISTINCT brand_crawl 
            FROM rb_kw 
            WHERE keyword_category IN ('Chocolates (Gifting)', 'Chocolates (Non Gifting)', 'GMFC')
            LIMIT 10
        `);
        console.log('Brands found in Mars categories:', brands.map(b => b.brand_crawl));

    } catch (err) {
        console.error(err);
    }
}

debugFilter();
