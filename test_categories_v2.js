import { queryClickHouse } from './backend/src/config/clickhouse.js';

async function checkCategories() {
    try {
        console.log('Querying categories from mars._j_sap_to_attrs...');
        const cats = await queryClickHouse(`SELECT DISTINCT category FROM mars._j_sap_to_attrs WHERE category IS NOT NULL AND category != '' ORDER BY category`);
        console.log('Categories:', cats);
    } catch (err) {
        console.error('Failed to fetch categories:', err);
    }
}

checkCategories();
