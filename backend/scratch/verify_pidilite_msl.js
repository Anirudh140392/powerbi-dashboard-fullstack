import { queryClickHouse, getCurrentDbName } from '../src/config/clickhouse.js';
import { dbStorage } from '../src/config/clickhouse.js';

async function run() {
    await dbStorage.run({ dbName: 'pidilite' }, async () => {
        try {
            console.log("Current DB Name:", getCurrentDbName());
            
            // Check lowercase msl distinct values and count
            const resLower = await queryClickHouse(`
                SELECT msl, count(*) as cnt 
                FROM rb_pdp_olap 
                GROUP BY msl 
                ORDER BY msl
            `);
            console.log("Lowercase msl counts:", resLower);

            // Check uppercase MSL distinct values and count
            const resUpper = await queryClickHouse(`
                SELECT MSL, count(*) as cnt 
                FROM rb_pdp_olap 
                GROUP BY MSL 
                ORDER BY MSL
            `);
            console.log("Uppercase MSL counts:", resUpper);

        } catch (e) {
            console.error("Error running test:", e);
        }
    });
}

run();
