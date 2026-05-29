import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const schema = await queryClickHouse('DESCRIBE rb_platform');
        console.log("Schema:", JSON.stringify(schema, null, 2));
        
        const data = await queryClickHouse('SELECT * FROM rb_platform LIMIT 5');
        console.log("Data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
