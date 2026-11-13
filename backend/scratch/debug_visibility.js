import { queryClickHouse } from '../src/config/clickhouse.js';

async function main() {
    try {
        console.log("Querying distinct platform_names from rb_kw_olap...");
        const platforms = await queryClickHouse("SELECT DISTINCT platform_name FROM rb_kw_olap");
        console.log(platforms);
    } catch (e) {
        console.error("Error:", e);
    }
}

main().then(() => process.exit(0));
