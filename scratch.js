import { queryClickHouse } from './backend/src/config/clickhouse.js';
async function test() {
    try {
        console.log("Databases:", await queryClickHouse("SHOW DATABASES"));
        console.log("Tables in default/current db:", await queryClickHouse("SHOW TABLES"));
        
        // Let's try querying rb_platform in all databases or the current one
        const databases = await queryClickHouse("SHOW DATABASES");
        for (const db of databases) {
            const dbName = db.name;
            try {
                const tables = await queryClickHouse(`SHOW TABLES FROM ${dbName}`);
                if (tables.some(t => t.name === 'rb_platform')) {
                    console.log(`Found rb_platform in ${dbName}`);
                    const rows = await queryClickHouse(`SELECT pf_name, platform_description, status FROM ${dbName}.rb_platform`);
                    console.log(`Rows in ${dbName}.rb_platform:`, rows);
                }
            } catch (err) {
                // skip
            }
        }
    } catch (e) {
        console.error(e);
    }
}
test();
