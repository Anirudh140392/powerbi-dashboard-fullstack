import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        console.log("Querying DESCRIBE rb_pdp_olap...");
        const resultPdp = await queryClickHouse("DESCRIBE rb_pdp_olap");
        console.log("=== rb_pdp_olap columns ===");
        console.log(resultPdp.map(r => `${r.name}: ${r.type}`).join('\n'));

        console.log("\nQuerying DESCRIBE rb_ms_olap...");
        const resultMs = await queryClickHouse("DESCRIBE rb_ms_olap");
        console.log("=== rb_ms_olap columns ===");
        console.log(resultMs.map(r => `${r.name}: ${r.type}`).join('\n'));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
