import { queryClickHouse, connectClickHouse } from '../src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testQuery(dbName) {
    console.log(`--- Testing DB: ${dbName} ---`);
    const startDate = '2026-03-01';
    const endDate = '2026-03-07';
    const compareStartDate = '2026-02-22';
    const compareEndDate = '2026-02-28';

    const isMars = dbName === 'mars';
    const channelCol = isMars ? 'p.channel' : 'p.Channel';
    const weightExpr = isMars ? "1" : "ifNull(toFloat64OrZero(extract(toString(p.Weight), '^[0-9.]+')), 0)";

    const query = `
    SELECT
        AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' AND ifNull(toFloat64OrZero(toString(p.MRP)), 0) > 0 
            THEN ((ifNull(toFloat64OrZero(toString(p.MRP)), 0) - ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(p.MRP)), 0)) * 100 ELSE NULL END) AS discount_curr,
        AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' 
                 AND ${weightExpr} > 0 
            THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) / ${weightExpr} 
            ELSE NULL END) AS price_per_unit_curr
    FROM ${dbName}.rb_pdp_olap p
    WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
    `;

    try {
        const results = await queryClickHouse(query);
        console.log("Success:", JSON.stringify(results, null, 2));
    } catch (err) {
        console.error("FAILED:", err.message);
    }
}

async function run() {
    await connectClickHouse();
    await testQuery('mars');
    await testQuery('colpal');
}
run();
