import { queryClickHouse } from './src/config/clickhouse.js';
import fs from 'fs';

async function checkSchema() {
    try {
        const query = `DESCRIBE TABLE mars.rb_pdp_olap`;
        const res = await queryClickHouse(query);
        const schema = res.map(r => r.name);
        fs.writeFileSync('schema_output.json', JSON.stringify(schema, null, 2), 'utf8');
        console.log("Written to schema_output.json");
    } catch (err) {
        console.error("Error:", err.message);
    }
}
checkSchema();
