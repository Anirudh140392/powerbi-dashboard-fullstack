import { queryClickHouse } from './src/config/clickhouse.js';

async function verifyFilters() {
    console.log('--- Verifying Competition Filters ---');

    const testCases = [
        {
            name: 'Formats (Categories) - Clean List',
            params: { filterType: 'formats' }
        },
        {
            name: 'Brands - Filtered by Format',
            params: { filterType: 'brands', format: 'Chocolates (Non Gifting)' }
        },
        {
            name: 'SKUs - Filtered by Brand and Format',
            params: { filterType: 'skus', format: 'Chocolates (Non Gifting)', brand: 'Cadbury' }
        }
    ];

    for (const test of testCases) {
        console.log(`\nTesting: ${test.name}`);
        try {
            // Simplified mock of getVisibilityFilterOptions logic
            const { filterType, format, brand, platform, city } = test.params;
            
            const url = `http://localhost:5000/api/visibility-analysis/filter-options?filterType=${filterType}&format=${format || ''}&brand=${brand || ''}`;
            console.log(`URL: ${url}`);
            
            // Instead of fetch, let's just log what we expect or run a small query if db is accessible
            // Since I am in the backend directory, I can try to import the service but usually easier to just check the result of a direct CLI query
        } catch (err) {
            console.error(err);
        }
    }
}

// verifyFilters();

// Direct Database Checks
async function checkData() {
    try {
        console.log('\n--- Checking Clean Categories ---');
        const categories = await queryClickHouse(`
            SELECT DISTINCT keyword_category 
            FROM rb_kw 
            WHERE keyword_category IN ('Chocolates (Gifting)', 'Chocolates (Non Gifting)', 'GMFC')
        `);
        console.log('Allowed Categories found:', categories.map(c => c.keyword_category));

        console.log('\n--- Checking SKU Names (Human Readable) ---');
        const skus = await queryClickHouse(`
            SELECT DISTINCT keyword_search_product 
            FROM rb_kw 
            WHERE keyword_search_product IS NOT NULL AND keyword_search_product != ''
            LIMIT 5
        `);
        console.log('Sample SKU Names:', skus.map(s => s.keyword_search_product));

    } catch (err) {
        console.error('Database check failed:', err);
    }
}

checkData();
