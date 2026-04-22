import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const dbsRes = await queryClickHouse('SHOW DATABASES');
        const dbs = dbsRes.map(d => d.name).filter(d => !['system', 'INFORMATION_SCHEMA', 'information_schema'].includes(d));
        
        for (let db of dbs) {
            try {
                const q1 = await queryClickHouse(`SELECT DISTINCT channel, platform FROM ${db}.rca_sku_dim WHERE platform ILIKE '%Amazon%'`);
                if (q1 && q1.length > 0) {
                    console.log(`DB ${db} rca_sku_dim Amazon channels:`, q1);
                }
            } catch (e) {}

            try {
                const q2 = await queryClickHouse(`SELECT DISTINCT channel, Platform FROM ${db}.rb_pdp_olap WHERE Platform ILIKE '%Amazon%'`);
                if (q2 && q2.length > 0) {
                    console.log(`DB ${db} rb_pdp_olap Amazon channels:`, q2);
                }
            } catch (e) {}
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
test();
