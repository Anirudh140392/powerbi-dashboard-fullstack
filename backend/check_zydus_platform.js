import { queryClickHouse, setCurrentDbName, asyncStorageMiddleware } from './src/config/clickhouse.js';

async function run() {
    // Simulate the context that authMiddleware would set
    // But since we are not in an express request, we can just use the client directly by specifying DB if possible,
    // or just use queryClickHouse and hope default works, OR manually set store if I can.
    // Actually queryClickHouse uses getCurrentClient() which uses getCurrentDbName().
    // We can't easily set AsyncLocalStorage from outside without a run() block.
    
    // Let's try to just query with the database prefix: zydus.rb_platform
    try {
        const schema = await queryClickHouse('DESCRIBE zydus.rb_platform');
        console.log("Schema (zydus.rb_platform):", JSON.stringify(schema, null, 2));
        
        const data = await queryClickHouse('SELECT * FROM zydus.rb_platform LIMIT 5');
        console.log("Data (zydus.rb_platform):", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
