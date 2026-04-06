import 'dotenv/config';
process.env.CLICKHOUSE_DB = 'zydus';
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const schema = await queryClickHouse('DESCRIBE zydus.rb_sku_platform');
        console.log("Schema (zydus.rb_sku_platform):", JSON.stringify(schema, null, 2));
        
        const data = await queryClickHouse('SELECT web_pid, image_url FROM zydus.rb_sku_platform LIMIT 5');
        console.log("Data (zydus.rb_sku_platform):", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
