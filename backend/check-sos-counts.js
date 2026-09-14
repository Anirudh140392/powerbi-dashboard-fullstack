import { connectClickHouse, queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    await connectClickHouse();
    try {
        const query = `
            SELECT 
                COUNT(*) as total, 
                COUNTIf(LOWER(brand) = 'dot & key') as brand_cnt,
                COUNTIf(toInt32(spons) = 0) as total_org,
                COUNTIf(LOWER(brand) = 'dot & key' AND toInt32(spons) = 0) as brand_org,
                COUNTIf(toInt32(spons) = 1) as total_spons,
                COUNTIf(LOWER(brand) = 'dot & key' AND toInt32(spons) = 1) as brand_spons
            FROM rb_kw_olap
            WHERE DATE BETWEEN '2026-06-01' AND '2026-06-30'
              AND keyword = 'dot & key skincare combo'
        `;
        const res = await queryClickHouse(query);
        console.log("Counts for 'dot & key skincare combo':", res);
        if (res.length > 0) {
            const r = res[0];
            console.log("Overall SOS:", (r.brand_cnt * 100.0 / r.total).toFixed(2));
            console.log("Organic SOS:", (r.brand_org * 100.0 / r.total_org).toFixed(2));
            console.log("Paid SOS:", (r.brand_spons * 100.0 / r.total_spons).toFixed(2));
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
