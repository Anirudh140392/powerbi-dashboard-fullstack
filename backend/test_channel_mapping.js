import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const results = await queryClickHouse(`
            SELECT DISTINCT platform, channel 
            FROM rca_sku_dim 
            WHERE platform IS NOT NULL AND platform != ''
        `);
        console.log("rca_sku_dim platform-channel mapping:", results);
        
        const msPlatforms = await queryClickHouse(`
            SELECT DISTINCT platform FROM rb_ms_olap
        `);
        console.log("rb_ms_olap platforms:", msPlatforms);
    } catch (err) {
        console.error(err);
    }
}
test().catch(console.error).finally(() => process.exit(0));
