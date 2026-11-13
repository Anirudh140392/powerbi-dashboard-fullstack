import { queryClickHouse } from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

async function listCols() {
    const results = await queryClickHouse('DESCRIBE TABLE rb_pdp_olap');
    console.log('Columns in rb_pdp_olap:');
    results.forEach(r => console.log(`- ${r.name} (${r.type})`));
}

listCols().catch(console.error).finally(() => process.exit());
