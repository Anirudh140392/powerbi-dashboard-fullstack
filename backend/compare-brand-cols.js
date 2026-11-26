import { connectClickHouse, queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    await connectClickHouse();
    try {
        console.log("Querying sample rows from rb_kw_olap showing brand vs brand_name_th...");
        const rows = await queryClickHouse(`
            SELECT brand, brand_name_th, COUNT(*) as cnt 
            FROM rb_kw_olap 
            WHERE brand != brand_name_th AND brand IS NOT NULL AND brand != '' AND brand_name_th IS NOT NULL AND brand_name_th != ''
            GROUP BY brand, brand_name_th 
            LIMIT 20
        `);
        console.log("Different brand vs brand_name_th rows:", rows);

        console.log("\nChecking counts of match/mismatch:");
        const counts = await queryClickHouse(`
            SELECT 
                countIf(brand = brand_name_th) as match_cnt,
                countIf(brand != brand_name_th) as mismatch_cnt,
                countIf(brand IS NULL OR brand = '') as empty_brand,
                countIf(brand_name_th IS NULL OR brand_name_th = '') as empty_brand_th
            FROM rb_kw_olap
        `);
        console.log("Counts comparison:", counts);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
