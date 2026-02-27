import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkDb() {
    try {
        const res = await queryClickHouse("DESCRIBE TABLE rb_brand_ms");
        console.log("Columns:", res.map(r => r.name).join(", "));
        
        const minMax = await queryClickHouse("SELECT MIN(created_on) as min, MAX(created_on) as max FROM rb_brand_ms");
        console.log("Date range for created_on:", minMax);
        
        try {
            const sampleDate = await queryClickHouse("SELECT DATE FROM rb_brand_ms LIMIT 1");
            console.log("Is there a DATE column?", sampleDate);
        } catch(e) {
            console.log("No DATE column.");
        }
    } catch(err) {
        console.log("Error:", err.message);
    }
}
checkDb();
