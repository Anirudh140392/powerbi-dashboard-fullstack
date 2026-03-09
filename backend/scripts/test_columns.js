import { queryClickHouse } from '../src/config/clickhouse.js';

async function test() {
    try {
        const columns = await queryClickHouse("DESCRIBE TABLE rca_sku_dim");
        console.log("Columns:", columns.map(c => c.name));

        const channels = await queryClickHouse("SELECT DISTINCT channel FROM rca_sku_dim");
        console.log("Channels:", channels);
    } catch (err) {
        console.error("Error:", err.message);
    }
}

test();
