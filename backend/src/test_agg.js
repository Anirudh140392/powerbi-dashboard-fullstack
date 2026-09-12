import 'dotenv/config';
import { connectClickHouse, queryClickHouse } from './config/clickhouse.js';
import { setRequestContext } from './utils/context.js'; // Assuming there's a context setter

async function run() {
    process.env.DB_NAME = 'boat'; // Or try with manual query
    const ch = await connectClickHouse();
    const res = await queryClickHouse('DESCRIBE watchtower_daily_agg_v4');
    console.log(res.filter(r => r.name.toLowerCase().includes('buy_box')));
    
    const res2 = await queryClickHouse('DESCRIBE rb_pdp_olap');
    console.log(res2.filter(r => r.name.toLowerCase().includes('buy_box')));
}
// We will just do a direct query using raw fetch
