import { queryClickHouse } from './backend/src/config/clickhouse.js';
const schema = await queryClickHouse('DESCRIBE rb_pdp_olap');
console.table(schema);
process.exit(0);
