import { config } from 'dotenv';
config({ path: '/home/asus/Music/powerbi-dashboard-fullstack/backend/.env' });
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const q1 = `SHOW TABLES LIKE '%sku_breakdown%'`;
        const res1 = await queryClickHouse(q1);
        console.log("sku_breakdown tables:", res1);

        const q2 = `DESCRIBE rb_brand_ms`;
        const res2 = await queryClickHouse(q2);
        console.log("rb_brand_ms columns:", res2.map(r => r.name));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
