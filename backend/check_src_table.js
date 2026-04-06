import 'dotenv/config';
process.env.CLICKHOUSE_DB = 'zydus';
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const schema1 = await queryClickHouse('DESCRIBE zydus.rb_pdp_olap');
        console.log('Schema for rb_pdp_olap:', schema1.map(s => s.name));
        
        const schema2 = await queryClickHouse('DESCRIBE zydus.rca_sku_dim');
        console.log('Schema for rca_sku_dim:', schema2.map(s => s.name));
        
        const images = await queryClickHouse('SELECT web_pid, image_url FROM zydus.rb_sku_platform WHERE image_url IS NOT NULL AND image_url != \'\' LIMIT 5');
        console.log('Sample images from rb_sku_platform:', JSON.stringify(images, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
