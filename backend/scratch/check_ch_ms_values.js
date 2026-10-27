import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from '../src/config/clickhouse.js';

const run = async () => {
    try {
        const results = await queryClickHouse("SELECT DISTINCT platform FROM rb_brand_ms LIMIT 20");
        console.log("platforms in rb_brand_ms:", results);
        
        const results2 = await queryClickHouse("SELECT DISTINCT location FROM rb_brand_ms LIMIT 20");
        console.log("locations in rb_brand_ms:", results2);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};
run();
