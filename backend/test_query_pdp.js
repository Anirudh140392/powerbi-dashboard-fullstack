import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function test() {
    try {
        const platform = 'Blinkit';
        const startDate = dayjs('2026-02-11').startOf('day');
        const endDate = dayjs('2026-03-11').endOf('day');

        const conds = `toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}' AND Platform LIKE '%${platform}%'`;

        const query = `
            SELECT
                Location,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS total_sales,
                SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS total_qty,
                SUM(ifNull(toFloat64OrZero(toString(Ad_Quantity_sold)), 0)) AS total_orders,
                (SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / NULLIF(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100 AS city_osa
            FROM rb_pdp_olap
            WHERE ${conds}
              AND Location IS NOT NULL AND Location != ''
            GROUP BY Location
            ORDER BY total_sales DESC
            LIMIT 10
        `;

        console.log('Running query:', query);
        const result = await queryClickHouse(query);
        console.log('Result:', JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

test();
