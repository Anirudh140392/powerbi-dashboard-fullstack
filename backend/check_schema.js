import { queryClickHouse } from './src/config/clickhouse.js';
import fs from 'fs';

async function checkSchema() {
    try {
        const res = await queryClickHouse("DESCRIBE TABLE rb_pdp_olap");
        fs.writeFileSync('pdp_schema.json', JSON.stringify(res, null, 2));
        console.log('Schema saved to pdp_schema.json');
    } catch (e) {
        console.error(e);
    }
}
checkSchema();
