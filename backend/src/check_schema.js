import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import fs from 'fs';

async function checkSchema() {
    try {
        const { queryClickHouse } = await import('./config/clickhouse.js');
        let output = '';

        output += '--- rb_sku_platform ---\n';
        const schema = await queryClickHouse('DESCRIBE rb_sku_platform');
        output += JSON.stringify(schema, null, 2) + '\n\n';

        output += '--- rb_pdp_olap ---\n';
        const schema2 = await queryClickHouse('DESCRIBE rb_pdp_olap');
        output += JSON.stringify(schema2, null, 2) + '\n\n';

        output += '--- rca_sku_dim ---\n';
        const schema3 = await queryClickHouse('DESCRIBE rca_sku_dim');
        output += JSON.stringify(schema3, null, 2) + '\n\n';

        fs.writeFileSync('schema_output.txt', output);
        console.log('Schema written to schema_output.txt');
    } catch (error) {
        console.error('Error checking schema:', error);
    }
}

checkSchema();
