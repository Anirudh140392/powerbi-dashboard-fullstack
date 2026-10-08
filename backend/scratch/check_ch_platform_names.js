import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from '../src/config/clickhouse.js';

const run = async () => {
    try {
        const results = await queryClickHouse("SELECT DISTINCT platform_name FROM rb_kw_olap LIMIT 20");
        console.log("platform_names in rb_kw_olap:", results);
        
        const results2 = await queryClickHouse("SELECT DISTINCT location_name FROM rb_kw_olap LIMIT 20");
        console.log("location_names in rb_kw_olap:", results2);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};
run();
