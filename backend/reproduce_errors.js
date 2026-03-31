
import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testQuery(name, query) {
    console.log(`\n--- Testing ${name} ---`);
    try {
        const results = await queryClickHouse(query);
        console.log(`${name} Success, rows:`, results.length);
    } catch (e) {
        console.error(`${name} Failed:`, e.message);
    }
}

async function run() {
    const startDate = '2026-02-01';
    const endDate = '2026-02-22';
    const platform = 'Blinkit'; // Default
    const brand = 'Boomer';
    const city = 'All';
    const category = 'All';

    // 1. Inventory Overview (The one we know fails)
    const invWhere = `toDate(DATE) BETWEEN '${startDate}' AND '${endDate}' AND Brand IN ('Boomer')`;
    const invQuery = `
        SELECT sum(drr) as totalDrr FROM (
            SELECT argMax(toFloat64(Inventory), DATE) as inventory, sum(ifNull(Qty_Sold, 0)) / 22 as drr
            FROM rb_pdp_olap WHERE ${invWhere} GROUP BY Product, Location
        )
    `;
    await testQuery("Inventory Overview", invQuery);

    // 2. Availability Analysis Report
    const availQuery = `
        SELECT toDate(t.DATE), t.Platform, t.Brand
        FROM rb_pdp_olap t
        LEFT JOIN (SELECT toDate(kw_crawl_date) as DATE, platform_name as Platform, brand_name as Brand, keyword_category as Category, count() as brand_kw_count FROM rb_kw_olap GROUP BY DATE, Platform, Brand, Category) s 
        ON toDate(t.DATE) = s.DATE AND t.Platform = s.Platform AND t.Brand = s.Brand AND t.Category = s.Category
        WHERE toDate(t.DATE) BETWEEN '${startDate}' AND '${endDate}'
        LIMIT 1
    `;
    await testQuery("Availability Analysis", availQuery);

    // 3. Inventory Analysis Report
    const invAnalysisQuery = `
        SELECT 
            DATE, Platform, Brand, Location as City, Category as Format, Product,
            round(argMax(toFloat64(Inventory), DATE), 2) as Current_Inventory,
            round(SUM(ifNull(Qty_Sold, 0)) / 30, 2) as DRR,
            round(if(DRR > 0, Current_Inventory / DRR, 0), 2) as DOH,
            round(if(8 > DOH, (8 - DOH) * DRR, 0), 2) as Req_PO_Quantity,
            round(Req_PO_Quantity / 24, 2) as Req_Boxes
        FROM rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'
        GROUP BY DATE, Platform, Brand, Location, Category, Product
        LIMIT 1
    `;
    await testQuery("Inventory Analysis Report", invAnalysisQuery);

    // 4. Content Analysis Report (Check if table exists)
    const contentQuery = `SELECT count() FROM gcpl.tb_content_score_data LIMIT 1`;
    await testQuery("Content Analysis", contentQuery);
}

run();
