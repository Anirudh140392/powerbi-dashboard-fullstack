import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    try {
        const res = await queryClickHouse("SELECT name, engine, data_paths, metadata_path FROM system.tables WHERE database = 'colpal' AND name IN ('rca_sku_dim', 'rb_pdp_olap', 'rb_sku_platform')");
        console.table(res);
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
test();
