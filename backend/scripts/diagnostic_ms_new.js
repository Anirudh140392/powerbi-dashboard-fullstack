import { config } from 'dotenv';
config({ path: '/home/asus/Music/powerbi-dashboard-fullstack/backend/.env' });
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const qSchema = `DESCRIBE rb_brand_ms`;
        const schema = await queryClickHouse(qSchema);
        console.log("Schema of rb_brand_ms:", schema.map(s => `${s.name} (${s.type})`));

        const qSample = `
            SELECT
                toDate(created_on) AS created_on,
                Location,
                brand,
                Platform,
                market_share
            FROM rb_brand_ms
            WHERE Platform LIKE '%Blinkit%'
            LIMIT 10
        `;
        const sample = await queryClickHouse(qSample);
        console.log("Sample data from rb_brand_ms:", JSON.stringify(sample, null, 2));
    } catch (e) {
        console.error("Error investigating rb_brand_ms:", e);
    }
    process.exit(0);
}
run();
