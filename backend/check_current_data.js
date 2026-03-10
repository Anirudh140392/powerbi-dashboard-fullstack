import { queryClickHouse } from './src/config/clickhouse.js';

async function checkCurrentData() {
    try {
        const results = await queryClickHouse(`
            SELECT 
                toDate(created_on) as date,
                count() as total_rows,
                countIf(toString(keyword_is_rb_product) = '1') as rb_rows
            FROM rb_kw_olap
            WHERE toDate(created_on) BETWEEN '2026-03-01' AND '2026-03-06'
            GROUP BY date
            ORDER BY date ASC
        `);
        console.log('Data for 2026-03-01 to 2026-03-06:');
        console.table(results);
    } catch (error) {
        console.error('Error checking current data:', error);
    }
}

checkCurrentData();
