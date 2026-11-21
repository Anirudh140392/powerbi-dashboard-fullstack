import { queryClickHouse } from './src/config/clickhouse.js';

async function describe() {
    try {
        console.log('--- rb_kw_olap ---');
        const kwSchema = await queryClickHouse('DESCRIBE rb_kw_olap');
        console.table(kwSchema);

        console.log('\n--- rb_pdp_olap ---');
        const pdpSchema = await queryClickHouse('DESCRIBE rb_pdp_olap');
        console.table(pdpSchema);
    } catch (err) {
        console.error(err);
    }
}

describe();
