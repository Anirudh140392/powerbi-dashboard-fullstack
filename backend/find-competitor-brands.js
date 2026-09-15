import { connectClickHouse, queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    await connectClickHouse();
    try {
        console.log("Querying distinct brands from rb_kw_olap...");
        const brands = await queryClickHouse(`
            SELECT brand_name_th, COUNT(*) as cnt 
            FROM rb_kw_olap 
            WHERE brand_name_th IS NOT NULL AND brand_name_th != ''
            GROUP BY brand_name_th 
            ORDER BY cnt DESC 
            LIMIT 20
        `);
        console.log("Brands:", brands);
        
        console.log("\nQuerying ownBrandSubquery results:");
        const ownBrands = await queryClickHouse(`
            SELECT DISTINCT lower(Brand) as b FROM rb_pdp_olap WHERE Comp_flag = 0 AND Brand IS NOT NULL AND Brand != ''
        `);
        console.log("Own Brands from rb_pdp_olap:", ownBrands.map(o => o.b));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
