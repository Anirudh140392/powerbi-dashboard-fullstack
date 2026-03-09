import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        console.log("Checking unique values in spons_flag:");
        const flags = await queryClickHouse("SELECT spons_flag, count() as cnt FROM rb_kw GROUP BY spons_flag");
        console.log(flags);

        console.log("\nSample rows where spons_flag = 1:");
        const samples = await queryClickHouse("SELECT * FROM rb_kw WHERE spons_flag = 1 LIMIT 1");
        if (samples.length > 0) {
            console.log(Object.keys(samples[0]).join(', '));
            console.log(samples[0]);
        }

    } catch (e) {
        console.error(e);
    }
}
test();
