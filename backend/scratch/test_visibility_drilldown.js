process.env.CLICKHOUSE_DB = 'pidilite';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function run() {
    const { queryClickHouse } = await import('../src/config/clickhouse.js');
    
    console.log("Querying distinct brands from rb_kw_olap...");
    const resBrands = await queryClickHouse(`
        SELECT brand, flag, COUNT(*) as cnt
        FROM rb_kw_olap
        WHERE DATE = '2026-06-15'
          AND lower(keyword) = 'super glue'
          AND lower(platform_name) = 'blinkit'
        GROUP BY brand, flag
        ORDER BY cnt DESC
    `);
    console.log("Brands and Flags:", JSON.stringify(resBrands, null, 2));
    process.exit(0);
}
run();
