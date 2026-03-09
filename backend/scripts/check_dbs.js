import { queryClickHouse } from '../src/config/clickhouse.js';

async function checkSchema() {
    try {
        const dbs = await queryClickHouse('SHOW DATABASES');
        console.log('Databases:');
        console.log(dbs);

        for (const db of dbs) {
            try {
                const tables = await queryClickHouse(`SHOW TABLES FROM ${db.name} LIKE '%pm%'`);
                if (tables.length > 0) {
                    console.log(`\nTables in ${db.name} matching %pm%:`);
                    console.log(tables);
                }
            } catch (e) { }

            try {
                const tables2 = await queryClickHouse(`SHOW TABLES FROM ${db.name} LIKE '%rca%'`);
                if (tables2.length > 0) {
                    console.log(`\nTables in ${db.name} matching %rca%:`);
                    console.log(tables2);
                }
            } catch (e) { }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error fetching databases:', error);
        process.exit(1);
    }
}

checkSchema();
