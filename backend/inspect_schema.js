import { queryClickHouse } from './src/config/clickhouse.js';

async function inspectSchema() {
    try {
        console.log('--- Inspecting rb_kw_olap schema ---');
        
        const columnsRes = await queryClickHouse('DESCRIBE TABLE rb_kw_olap');
        console.log('Columns:');
        columnsRes.forEach(col => {
            console.log(`- ${col.name} (${col.type})`);
        });

        const sampleRes = await queryClickHouse('SELECT * FROM rb_kw_olap LIMIT 1');
        console.log('\nSample record:', JSON.stringify(sampleRes[0], null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

inspectSchema();
