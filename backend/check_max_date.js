import { queryClickHouse } from './src/config/clickhouse.js';

async function checkMaxDate() {
    try {
        const results = await queryClickHouse(`
            SELECT 
                MAX(toDate(created_on)) as max_date,
                MIN(toDate(created_on)) as min_date,
                count() as total_rows
            FROM rb_kw
        `);
        console.log('rb_kw table date range:');
        console.table(results);

        const recent = await queryClickHouse(`
            SELECT toDate(created_on) as date, count() as count
            FROM rb_kw
            GROUP BY date
            ORDER BY date DESC
            LIMIT 10
        `);
        console.log('Most recent data points:');
        console.table(recent);
    } catch (error) {
        console.error('Error checking max date:', error);
    }
}

checkMaxDate();
