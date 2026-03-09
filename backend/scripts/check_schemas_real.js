
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSchemas() {
    try {
        console.log('--- rb_pdp_olap ---');
        const pdp = await queryClickHouse('DESCRIBE rb_pdp_olap');
        console.log(pdp.map(c => c.name).join(', '));

        console.log('\n--- rca_sku_dim ---');
        const sku = await queryClickHouse('DESCRIBE rca_sku_dim');
        console.log(sku.map(c => c.name).join(', '));

        console.log('\n--- rb_brand_ms ---');
        const ms = await queryClickHouse('DESCRIBE rb_brand_ms');
        console.log(ms.map(c => c.name).join(', '));
    } catch (err) {
        console.error(err);
    }
}

checkSchemas();
