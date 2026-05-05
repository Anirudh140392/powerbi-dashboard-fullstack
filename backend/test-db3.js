import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const result = await queryClickHouse("DESCRIBE GCPL.rb_pdp_olap");
        console.log(result.map(r => r.name).filter(n => n.toLowerCase().includes('deliver') || n.toLowerCase().includes('date') || n.toLowerCase().includes('time')));
    } catch(err) {
        console.error(err);
    }
}
run();
