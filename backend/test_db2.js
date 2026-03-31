import { queryClickHouse } from './src/config/clickhouse.js';
async function run() {
    try {
        const res = await queryClickHouse("DESCRIBE TABLE rb_pdp_olap");
        console.log("COLUMNS:");
        res.forEach(r => {
            if (r.name.toLowerCase().includes('ad_') || r.Name?.toLowerCase().includes('ad_')) {
                console.log(r.name || r.Name);
            }
        });
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
