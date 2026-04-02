import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const schema = await queryClickHouse('DESCRIBE zydus.rb_ms_olap');
        console.log("Schema (zydus.rb_ms_olap):", JSON.stringify(schema, null, 2));
        
        const data = await queryClickHouse('SELECT * FROM zydus.rb_ms_olap LIMIT 5');
        console.log("Data (zydus.rb_ms_olap):", JSON.stringify(data, null, 2));
        
        const brands = await queryClickHouse('SELECT DISTINCT group_brand FROM zydus.rb_ms_olap LIMIT 10');
        console.log("Brands (zydus.rb_ms_olap):", JSON.stringify(brands, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
