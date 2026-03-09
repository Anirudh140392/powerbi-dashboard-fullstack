import { queryClickHouse } from './src/config/clickhouse.js';

async function checkCategoryKeywords() {
    try {
        const results = await queryClickHouse(`
            SELECT keyword, keyword_type, count() as count
            FROM rb_kw
            WHERE keyword_type = 'Category'
            GROUP BY keyword, keyword_type
            LIMIT 10
        `);
        console.log('Sample Category keywords:');
        results.forEach(r => console.log(`${r.keyword} (${r.keyword_type}): ${r.count}`));
    } catch (error) {
        console.error('Error checking category keywords:', error);
    }
}

checkCategoryKeywords();
