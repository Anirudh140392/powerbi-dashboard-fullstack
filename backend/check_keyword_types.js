import { queryClickHouse } from './src/config/clickhouse.js';

async function checkKeywordTypes() {
    try {
        const results = await queryClickHouse(`
            SELECT DISTINCT keyword_type
            FROM rb_kw
            WHERE keyword_type IS NOT NULL AND keyword_type != ''
        `);
        console.log('Distinct keyword_type values:');
        console.table(results);
    } catch (error) {
        console.error('Error checking keyword types:', error);
    }
}

checkKeywordTypes();
