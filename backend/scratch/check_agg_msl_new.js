import { queryClickHouse } from '../src/config/clickhouse.js';

async function check() {
    try {
        console.log("Checking ClickHouse tables...");
        const result = await queryClickHouse("EXISTS TABLE watchtower_agg_daily");
        console.log("watchtower_agg_daily exists?", result);

        if (result && result[0] && result[0].result === 1) {
            console.log("watchtower_agg_daily exists, showing columns containing msl:");
            const cols = await queryClickHouse("DESCRIBE TABLE watchtower_agg_daily");
            cols.forEach(c => {
                if (c.name.toLowerCase().includes('msl')) {
                    console.log("  column:", c);
                }
            });
        }

        console.log("DESCRIBE TABLE rb_pdp_olap columns containing msl:");
        const colsPdp = await queryClickHouse("DESCRIBE TABLE rb_pdp_olap");
        colsPdp.forEach(c => {
            if (c.name.toLowerCase().includes('msl')) {
                console.log("  column:", c);
            }
        });

        process.exit(0);
    } catch (err) {
        console.error("Error running query:", err);
        process.exit(1);
    }
}

check();
