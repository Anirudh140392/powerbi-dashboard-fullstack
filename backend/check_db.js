import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSchema() {
    try {
        const results = await queryClickHouse('DESCRIBE TABLE rb_pdp_olap');
        console.log('--- TABLE SCHEMA ---');
        results.forEach(r => {
            if (r.name.toLowerCase().includes('comp')) {
                console.log(`Column: ${r.name}, Type: ${r.type}`);
            }
        });
        
        const dataSample = await queryClickHouse("SELECT Product, Brand, Comp_flag FROM rb_pdp_olap WHERE Product LIKE '%5 Star%' LIMIT 5");
        console.log('\n--- DATA SAMPLE ---');
        console.log(JSON.stringify(dataSample, null, 2));
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
