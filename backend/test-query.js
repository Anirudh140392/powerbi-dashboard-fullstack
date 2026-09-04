import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    const msQuery = `
WITH ms_curr AS (
    SELECT 
        multiIf(LOWER(location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(location)) AS city, 
        platform, 
        category, 
        group_brand, 
        item_name,
        SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) AS sku_sales
    FROM rb_ms_olap
    WHERE toDate(created_on) BETWEEN '2026-04-01' AND '2026-04-25' 
      AND item_name IS NOT NULL AND item_name != ''
      AND LOWER(platform) IN ('instamart')
      AND multiIf(LOWER(location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(location)) IN ('Gurugram')
      AND LOWER(category) IN ('chocolates (non gifting)')
    GROUP BY city, platform, category, group_brand, item_name
)
SELECT * FROM ms_curr LIMIT 10;
    `;

    console.log("Running corrected MS Query...");
    try {
        const msData = await queryClickHouse(msQuery);
        console.log("MS Data:", msData);
    } catch (e) {
        console.error(e.message);
    }
    process.exit(0);
}

test();
