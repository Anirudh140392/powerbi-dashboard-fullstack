import { queryClickHouse } from '../src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testDictGet() {
    try {
        console.log("=== Testing dictGet ===");

        // Test dict_city_alias
        const res1 = await queryClickHouse(`
            SELECT dictGet('mars.dict_city_alias', 'canonical_city', tuple('mumbai')) as res
        `);
        console.log("dict_city_alias test (mumbai):", res1[0]);

        // Test dict_feeder_city
        const res2 = await queryClickHouse(`
            SELECT dictGet('mars.dict_feeder_city', 'city', tuple('zepto:bangalore central dc')) as res
        `);
        console.log("dict_feeder_city test (zepto:bangalore central dc):", res2[0]);

    } catch (err) {
        console.error("dictGet test failed:", err.message);
    }
    process.exit(0);
}

testDictGet();
