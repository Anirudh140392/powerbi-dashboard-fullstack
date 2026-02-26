import { queryClickHouse } from './src/config/clickhouse.js';

async function debug() {
    // Check gram coverage per category
    const gramQuery = `
        SELECT
            p.Category,
            COUNT(*) AS total_records,
            SUM(CASE WHEN s.gram > 0 THEN 1 ELSE 0 END) AS has_gram,
            SUM(CASE WHEN toString(p.Comp_flag) = '0' THEN 1 ELSE 0 END) AS own_brand_count,
            SUM(CASE WHEN toString(p.Comp_flag) = '1' THEN 1 ELSE 0 END) AS competitor_count,
            AVG(CASE WHEN toFloat64OrNull(p.MRP) > 0 THEN toFloat64(p.MRP) END) AS avg_mrp,
            AVG(CASE WHEN toFloat64OrNull(p.Selling_Price) > 0 THEN toFloat64(p.Selling_Price) END) AS avg_sp
        FROM rb_pdp_olap p
        LEFT JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
        WHERE p.DATE BETWEEN '2026-02-01' AND '2026-02-23'
            AND p.Selling_Price IS NOT NULL
            AND toFloat64OrNull(p.Selling_Price) > 0
        GROUP BY p.Category
        ORDER BY total_records DESC
        LIMIT 20
    `;

    const results = await queryClickHouse(gramQuery);
    console.log('\n=== CATEGORY DATA DEBUG ===');
    results.forEach(r => {
        console.log(`${r.Category}:`);
        console.log(`  total: ${r.total_records}, has_gram: ${r.has_gram}, own: ${r.own_brand_count}, comp: ${r.competitor_count}`);
        console.log(`  avg_mrp: ${r.avg_mrp}, avg_sp: ${r.avg_sp}`);
    });
    process.exit(0);
}

debug().catch(e => { console.error(e); process.exit(1); });
