import { queryClickHouse } from '../backend/src/config/clickhouse.js';

async function test() {
    try {
        const query = "SELECT Brand, Category, COUNT(*) as count FROM rb_pdp_olap WHERE lower(Brand) LIKE '%boomer%' GROUP BY Brand, Category";
        console.log("Executing query:", query);
        const results = await queryClickHouse(query);
        console.log("Results:", JSON.stringify(results, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
