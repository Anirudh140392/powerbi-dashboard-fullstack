import { queryClickHouse } from './src/config/clickhouse.js';

async function checkBlinkitDates() {
    try {
        console.log('--- Blinkit dates in rb_ms_olap ---');
        const blinkitDates = await queryClickHouse(`
            SELECT MIN(toDate(created_on)) as min_d, MAX(toDate(created_on)) as max_d, count() as cnt, SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE lower(platform) = 'blinkit'
        `);
        console.log('Blinkit overall:', blinkitDates);

        const blinkitAug = await queryClickHouse(`
            SELECT toDate(created_on) as dt, count() as cnt, SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE lower(platform) = 'blinkit'
            GROUP BY dt ORDER BY dt DESC LIMIT 15
        `);
        console.log('Blinkit daily recent sales:', blinkitAug);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkBlinkitDates();
