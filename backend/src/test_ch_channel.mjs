import 'dotenv/config';
import { connectClickHouse, queryClickHouse } from './config/clickhouse.js';
await connectClickHouse();
const res = await queryClickHouse('DESCRIBE rb_pdp_olap');
console.log(res.filter(r => r.name.toLowerCase().includes('buy_box') || r.name.toLowerCase().includes('osa') || r.name.toLowerCase().includes('channel')));
process.exit(0);
