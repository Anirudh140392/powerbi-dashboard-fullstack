import { queryClickHouse } from './src/config/clickhouse.js';

async function testSQL() {
    const query = `
        SELECT
            Location,
            SUM(ifNull(toFloat64OrZero(toString(Sales)), 0))          AS total_sales,
            SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0))        AS total_qty,
            SUM(ifNull(toFloat64OrZero(toString(Ad_Quantity_sold)), 0)) AS total_orders,
            (
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) /
                NULLIF(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)
            ) * 100 AS city_osa,
            AVG(ifNull(toFloat64OrZero(toString(listing_percent)), 0)) AS city_listing
        FROM rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '2025-01-01' AND '2025-01-31'
        GROUP BY Location
        LIMIT 5
    `;
    try {
        await queryClickHouse(query);
        console.log('Query succeeded with Ad_Quantity_sold!');
    } catch (e) {
        console.log('SQL ERROR =', e.message);
    }
}
testSQL();
